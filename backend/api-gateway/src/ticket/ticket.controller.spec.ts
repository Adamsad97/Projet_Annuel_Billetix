import { of, throwError } from "rxjs";
import { TicketController } from "./ticket.controller";
import type { TicketsGateway } from "../events/tickets.gateway";

// Instanciation directe (pas de TestingModule) : aucun test existant pour ce
// contrôleur, et seule notifyResaleSold()/wantsResaleUpdates() sont visées
// ici — pas besoin de câbler les guards/décorateurs HTTP pour ça.
describe("TicketController — notification de revente (préférences niveau 2)", () => {
  let controller: TicketController;
  let ticketClient: { send: jest.Mock };
  let orderClient: { send: jest.Mock };
  let paymentClient: { send: jest.Mock };
  let eventClient: { send: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let authClient: { send: jest.Mock };
  let userClient: { send: jest.Mock };
  let pdfClient: { emit: jest.Mock };
  let adminClient: { send: jest.Mock };

  const resale = {
    id: "resale-1",
    original_buyer_id: "seller-1",
    ticket_id: "ticket-1",
    resale_price: 10,
  };

  const ticketFixture = {
    id: "ticket-1",
    reference: "TKT-2026-000001",
    order_id: "order-2",
    event_name: "Concert Test",
    event_start_at: "2026-12-01T20:00:00.000Z",
    event_venue_name: "Zenith",
    event_venue_address: "1 rue Test",
    event_city: "Paris",
    artist_name: "DJ Test",
    ticket_category_name: "Standard",
    unit_price_ttc: 20,
    holder_first_name: "Marie",
    holder_last_name: "Martin",
    buyer_email: "marie@test.com",
    qr_code_url: "data:image/png;base64,abc",
    pdf_url: "http://minio/ticket.pdf",
  };

  beforeEach(() => {
    ticketClient = { send: jest.fn().mockReturnValue(of(ticketFixture)), emit: jest.fn() } as any;
    orderClient = { send: jest.fn() };
    paymentClient = { send: jest.fn() };
    eventClient = { send: jest.fn() };
    notifClient = { emit: jest.fn() };
    authClient = {
      send: jest.fn().mockReturnValue(of({ email: "vendeur@test.com", first_name: "Vendeur" })),
    };
    // Par défaut : aucune préférence enregistrée -> notification envoyée (fail-open).
    userClient = { send: jest.fn().mockReturnValue(of({})) };
    pdfClient = { emit: jest.fn() };
    adminClient = {
      send: jest
        .fn()
        .mockReturnValue(of({ ticket_pdf_wait_max_attempts: 1, ticket_pdf_wait_delay_seconds: 0 })),
    };

    controller = new TicketController(
      ticketClient as any,
      orderClient as any,
      paymentClient as any,
      eventClient as any,
      notifClient as any,
      authClient as any,
      userClient as any,
      pdfClient as any,
      adminClient as any,
      {} as TicketsGateway,
    );
  });

  it("notifie le vendeur original quand la préférence n'est pas désactivée", async () => {
    await (controller as any).notifyResaleSold(resale);

    expect(userClient.send).toHaveBeenCalledWith("user.get_notification_prefs", {
      user_id: "seller-1",
    });
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.resale_sold",
      expect.objectContaining({
        email: "vendeur@test.com",
        firstName: "Vendeur",
        eventName: "Concert Test",
        resalePrice: "10.00",
      }),
    );
  });

  it("n'envoie rien si le vendeur a désactivé resale-updates", async () => {
    userClient.send.mockReturnValue(of({ "resale-updates": false }));

    await (controller as any).notifyResaleSold(resale);

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("envoie par défaut (fail-open) si les préférences sont illisibles", async () => {
    userClient.send.mockReturnValue(throwError(() => new Error("user-service injoignable")));

    await (controller as any).notifyResaleSold(resale);

    expect(notifClient.emit).toHaveBeenCalled();
  });

  it("n'envoie rien si le vendeur original est introuvable (email manquant)", async () => {
    authClient.send.mockReturnValue(of(null));

    await (controller as any).notifyResaleSold(resale);

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("envoie au nouvel acheteur le même email \"billet prêt\" qu'un achat classique, avec le PDF régénéré", async () => {
    await (controller as any).notifyBuyerResalePurchase("ticket-1");

    expect(pdfClient.emit).toHaveBeenCalledWith(
      "pdf.generate_ticket",
      expect.objectContaining({ ticket_id: "ticket-1", buyer_email: "marie@test.com" }),
    );
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.ticket_ready",
      expect.objectContaining({
        email: "marie@test.com",
        firstName: "Marie",
        eventName: "Concert Test",
        tickets: [
          expect.objectContaining({
            ticketNumber: "TKT-2026-000001",
            pdfUrl: "http://minio/ticket.pdf",
          }),
        ],
      }),
    );
  });
});

describe("TicketController — marketplace de revente (listing enrichi)", () => {
  let controller: TicketController;
  let ticketClient: { send: jest.Mock };
  let eventClient: { send: jest.Mock };

  beforeEach(() => {
    ticketClient = { send: jest.fn() };
    eventClient = { send: jest.fn() };

    controller = new TicketController(
      ticketClient as any,
      {} as any,
      {} as any,
      eventClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as TicketsGateway,
    );
  });

  it("enrichit chaque annonce avec le nom d'événement/lieu/affiche et le nom de catégorie", async () => {
    ticketClient.send.mockReturnValue(
      of([
        { id: "resale-1", event_id: "event-1", ticket_category_id: "cat-1", resale_price: 20 },
        { id: "resale-2", event_id: "event-1", ticket_category_id: "cat-2", resale_price: 30 },
      ]),
    );
    eventClient.send.mockImplementation((pattern: string) => {
      if (pattern === "event.get") {
        return of({ title: "Concert Test", venue_name: "Zenith", venue_city: "Paris", poster_url: "poster.jpg" });
      }
      if (pattern === "event.get_categories") {
        return of([
          { id: "cat-1", name: "Standard" },
          { id: "cat-2", name: "VIP" },
        ]);
      }
      return of(null);
    });

    const result = await controller.listAllResale();

    expect(result).toEqual([
      expect.objectContaining({ id: "resale-1", event_name: "Concert Test", category_name: "Standard" }),
      expect.objectContaining({ id: "resale-2", event_name: "Concert Test", category_name: "VIP" }),
    ]);
    // Un seul appel par événement distinct, pas un par annonce (2 annonces, 1 événement).
    expect(eventClient.send).toHaveBeenCalledTimes(2);
  });

  it("retombe sur des valeurs par défaut si event-service est injoignable, sans faire échouer le listing", async () => {
    ticketClient.send.mockReturnValue(
      of([{ id: "resale-1", event_id: "event-1", ticket_category_id: "cat-1", resale_price: 20 }]),
    );
    eventClient.send.mockReturnValue(throwError(() => new Error("event-service injoignable")));

    const result = await controller.listAllResale();

    expect(result).toEqual([
      expect.objectContaining({ id: "resale-1", event_name: "Événement", category_name: "Billet" }),
    ]);
  });
});
