import jsQR from "jsqr";
import { PNG } from "pngjs";
import { api, del, get, post } from "./support/api";
import {
  Account,
  PASSWORD,
  RUN_ID,
  adminCredentials,
  createVerifiedAccount,
  login,
  minutesFromNow,
  pngImage,
} from "./support/fixtures";

const STRIPE_SECRET_KEY = process.env.E2E_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const admin = adminCredentials();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Réessaie jusqu'à ce que la condition soit remplie : la suite d'un paiement passe par des files de messages. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 45_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!done(value) && Date.now() < deadline) {
    await sleep(1000);
    value = await read();
  }
  return value;
}

function decodeQr(dataUrl: string): string {
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!decoded) throw new Error("QR illisible");
  return decoded.data;
}

/** Stripe en mode test : confirme le paiement comme le ferait le formulaire de carte du site. */
async function confirmStripePayment(clientSecret: string): Promise<string> {
  const intentId = clientSecret.split("_secret")[0];
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${STRIPE_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ payment_method: "pm_card_visa", return_url: `${FRONTEND_URL}/commande/confirmation` }),
  });
  return ((await response.json()) as { status: string }).status;
}

describe("Parcours organisateur → achat → contrôle d'entrée (fonctionnel)", () => {
  let organizer: Account;
  let buyer: Account;
  let eventId: string;
  let categoryId: string;
  let priceTtc: number;

  beforeAll(async () => {
    organizer = await createVerifiedAccount("orga", "ORGANIZER");
    buyer = await createVerifiedAccount("acheteur");
  });

  afterAll(async () => {
    // L'acheteur exerce son droit à l'effacement ; l'organisateur garde un événement publié, donc son compte reste.
    if (buyer) await del("/users/me", { password: PASSWORD }, buyer.token);
  });

  it("cloisonne les rôles : un acheteur ne crée pas d'événement, un organisateur n'accède pas à l'administration", async () => {
    expect((await post("/events", { title: "Interdit" }, buyer.token)).status).toBe(403);
    expect((await get("/admin/kyc/pending-count", organizer.token)).status).toBe(403);
  });

  it("refuse une affiche qui n'est pas une image", async () => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from("pas une image")], { type: "image/png" }), "faux.png");
    expect((await api("POST", "/upload/poster", { form, token: organizer.token })).status).toBe(400);
  });

  it("l'organisateur crée un événement avec son affiche et une catégorie de billets, puis le soumet", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(pngImage())], { type: "image/png" }), "affiche.png");
    const poster = await api("POST", "/upload/poster", { form, token: organizer.token });
    expect(poster.status).toBe(201);

    // Début proche : les entrées sont ouvertes (scan_opens_before_minutes) et le scan peut être testé.
    const start = minutesFromNow(30);
    const created = await post(
      "/events",
      {
        title: `E2E ${RUN_ID} Concert`,
        description: "Événement créé par les tests fonctionnels automatisés.",
        category: "CONCERT",
        start_date: start,
        end_date: minutesFromNow(210),
        venue_name: "Salle E2E",
        venue_address_line1: "1 rue des Tests",
        venue_city: "Paris",
        venue_postal_code: "75001",
        venue_country: "France",
        poster_url: poster.body.url,
        total_capacity: 100,
        sales_start_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        sales_end_date: start,
        refund_policy: "NON_REFUNDABLE",
      },
      organizer.token,
    );
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("DRAFT");
    eventId = created.body.id;

    const category = await post(
      `/events/${eventId}/categories`,
      { name: "Standard", price_ht: 20, quota: 50, max_per_order: 5, visibility: "PUBLIC" },
      organizer.token,
    );
    expect(category.status).toBe(201);
    categoryId = category.body.id;
    priceTtc = Number(category.body.price_ttc);
    expect(priceTtc).toBeCloseTo(24, 2);

    const submitted = await post(`/events/${eventId}/submit`, {}, organizer.token);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("PENDING_VALIDATION");
  });

  it("un acheteur ne peut pas réserver tant que l'événement n'est pas publié", async () => {
    const reserve = await post(
      "/orders/reserve",
      { event_id: eventId, items: [{ ticket_category_id: categoryId, quantity: 1 }] },
      buyer.token,
    );
    expect(reserve.status).toBeGreaterThanOrEqual(400);
  });

  const withAdmin = admin ? describe : describe.skip;
  withAdmin("après validation par un administrateur", () => {
    beforeAll(async () => {
      const adminAccount = await login(admin!.email, admin!.password);
      const approved = await post(`/admin/events/${eventId}/approve`, {}, adminAccount.token);
      if (approved.status !== 200)
        throw new Error(`Validation admin : ${approved.status} ${JSON.stringify(approved.body)}`);
    });

    it("l'événement publié apparaît dans le catalogue public", async () => {
      const event = await get(`/events/${eventId}`);
      expect(event.status).toBe(200);
      expect(event.body.status).toBe("PUBLISHED");
    });

    const withStripe = STRIPE_SECRET_KEY?.startsWith("sk_test_") ? describe : describe.skip;
    withStripe("achat payé par carte (Stripe, mode test)", () => {
      let orderId: string;
      let ticketIds: string[];

      it("réserve, commande et paie deux billets ; la commande est confirmée et les billets émis", async () => {
        const items = [{ ticket_category_id: categoryId, quantity: 2 }];
        const reserve = await post("/orders/reserve", { event_id: eventId, items }, buyer.token);
        expect(reserve.status).toBe(201);

        const order = await post(
          "/orders",
          {
            event_id: eventId,
            reservation_token: reserve.body.reservation_token,
            items,
            billing_first_name: "Test",
            billing_last_name: "Acheteur",
            billing_email: buyer.email,
            billing_address_line1: "1 rue des Tests",
            billing_city: "Paris",
            billing_postal_code: "75001",
            billing_country: "France",
            payment_method: "STRIPE",
          },
          buyer.token,
        );
        expect(order.status).toBe(201);
        orderId = order.body.order.id;
        expect(order.body.order.status).toBe("PENDING_PAYMENT");
        expect(Number(order.body.order.total_amount_ttc)).toBeCloseTo(2 * priceTtc, 2);

        const intent = await post("/payments/intent", { order_id: orderId }, buyer.token);
        expect(intent.status).toBe(201);
        expect(await confirmStripePayment(intent.body.client_secret)).toBe("succeeded");
        await post(`/payments/orders/${orderId}/sync`, {}, buyer.token);

        const paid = await eventually(
          () => get(`/orders/${orderId}`, buyer.token),
          (r) => r.body?.order?.status === "CONFIRMED",
        );
        expect(paid.body.order.status).toBe("CONFIRMED");

        const tickets = await eventually(
          () => get(`/tickets/order/${orderId}`, buyer.token),
          (r) => Array.isArray(r.body) && r.body.length === 2,
        );
        expect(tickets.body).toHaveLength(2);
        ticketIds = tickets.body.map((ticket: { id: string }) => ticket.id);
      });

      it("la commande d'un acheteur n'est pas lisible par un autre utilisateur", async () => {
        expect([403, 404]).toContain((await get(`/orders/${orderId}`, organizer.token)).status);
        expect([403, 404]).toContain((await get(`/tickets/${ticketIds[0]}`, organizer.token)).status);
      });

      it("met la facture PDF à disposition de l'acheteur", async () => {
        const invoice = await eventually(
          () => api("GET", `/orders/${orderId}/invoice`, { token: buyer.token }),
          (r) => r.status === 200,
        );
        expect(invoice.status).toBe(200);
      });

      it("à l'entrée, le QR affiché est accepté une fois puis refusé", async () => {
        const qr = await get(`/tickets/${ticketIds[0]}/qr`, buyer.token);
        expect(qr.status).toBe(200);
        const qrToken = decodeQr(qr.body.qr_code_url);

        const first = await post("/tickets/scan", { event_id: eventId, qr_token: qrToken }, organizer.token);
        expect(first.status).toBe(200);
        expect(first.body.result).toBe("SUCCESS");

        const second = await post("/tickets/scan", { event_id: eventId, qr_token: qrToken }, organizer.token);
        expect(second.body.result).toBe("ALREADY_USED");

        const stats = await get(`/tickets/event/${eventId}/entry-stats`, organizer.token);
        expect(stats.body).toEqual({ admitted: 1, expected: 2 });
      });

      it("l'export RGPD contient la commande et les billets de l'acheteur, l'événement de l'organisateur", async () => {
        const buyerExport = await get("/users/me/export", buyer.token);
        expect(buyerExport.status).toBe(200);
        expect(buyerExport.body.buyer.orders.map((order: { id: string }) => order.id)).toContain(orderId);
        expect(buyerExport.body.buyer.tickets.map((ticket: { id: string }) => ticket.id)).toEqual(
          expect.arrayContaining(ticketIds),
        );

        const organizerExport = await get("/users/me/export", organizer.token);
        expect(organizerExport.status).toBe(200);
        expect(organizerExport.body.organizer.events.map((event: { id: string }) => event.id)).toContain(eventId);
      });

      it("un acheteur ne peut pas scanner les billets d'un événement", async () => {
        const qr = await get(`/tickets/${ticketIds[1]}/qr`, buyer.token);
        const scan = await post(
          "/tickets/scan",
          { event_id: eventId, qr_token: decodeQr(qr.body.qr_code_url) },
          buyer.token,
        );
        expect(scan.status).toBe(403);
      });
    });
  });
});
