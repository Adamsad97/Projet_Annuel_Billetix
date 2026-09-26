import { ForbiddenException } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { TicketController } from "./ticket.controller";
import type { JwtPayload } from "../common/decorators/current-user.decorator";
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
      { readStoredFile: jest.fn().mockResolvedValue(Buffer.from("%PDF")) } as any,
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

  it("confirme au vendeur que la mise en vente a bien été prise en compte", async () => {
    await (controller as any).notifyResaleListed("seller-1", {
      ticket_id: "ticket-1",
      resale_price: 15,
    });

    expect(userClient.send).toHaveBeenCalledWith("user.get_notification_prefs", {
      user_id: "seller-1",
    });
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.resale_listed",
      expect.objectContaining({
        email: "vendeur@test.com",
        firstName: "Vendeur",
        eventName: "Concert Test",
        resalePrice: "15.00",
      }),
    );
  });

  it("n'envoie pas la confirmation de mise en vente si le vendeur a désactivé resale-updates", async () => {
    userClient.send.mockReturnValue(of({ "resale-updates": false }));

    await (controller as any).notifyResaleListed("seller-1", {
      ticket_id: "ticket-1",
      resale_price: 15,
    });

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("régénère le PDF et envoie l'email d'accès au billet, sans billet ni QR code", async () => {
    await (controller as any).notifyBuyerResalePurchase("ticket-1");

    expect(pdfClient.emit).toHaveBeenCalledWith(
      "pdf.generate_ticket",
      expect.objectContaining({ ticket_id: "ticket-1", buyer_email: "marie@test.com" }),
    );
    // Le PDF n'est pas un titre d'accès : aucun QR code à y imprimer.
    expect(pdfClient.emit.mock.calls[0][1]).not.toHaveProperty("qr_code_url");
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.ticket_ready",
      expect.objectContaining({
        email: "marie@test.com",
        firstName: "Marie",
        eventName: "Concert Test",
        tickets: [expect.objectContaining({ ticketNumber: "TKT-2026-000001" })],
      }),
    );
    // Sécurité : jamais le PDF ni le QR code dans l'email.
    const payload = notifClient.emit.mock.calls.find(([pattern]) => pattern === "notification.ticket_ready")[1];
    expect(payload.tickets[0]).not.toHaveProperty("pdfUrl");
    expect(payload.tickets[0]).not.toHaveProperty("qrCodeUrl");
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
      { readStoredFile: jest.fn().mockResolvedValue(Buffer.from("%PDF")) } as any,
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

describe("TicketController — consultation restreinte au propriétaire (bug corrigé)", () => {
  let controller: TicketController;
  let ticketClient: { send: jest.Mock };
  let orderClient: { send: jest.Mock };
  const user = { sub: "buyer-1", email: "buyer@test.com", role: "BUYER" } as JwtPayload;

  beforeEach(() => {
    ticketClient = { send: jest.fn() };
    orderClient = { send: jest.fn() };

    controller = new TicketController(
      ticketClient as any,
      orderClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as TicketsGateway,
      { readStoredFile: jest.fn().mockResolvedValue(Buffer.from("%PDF")) } as any,
    );
  });

  it("getById renvoie le billet quand il appartient bien à l'appelant", async () => {
    ticketClient.send.mockImplementation((pattern: string) =>
      of(pattern === "ticket.get" ? { id: "ticket-1", buyer_id: "buyer-1" } : []),
    );

    const result = await controller.getById(user, "ticket-1");

    expect(result).toEqual({ id: "ticket-1", buyer_id: "buyer-1", received_from: null, resale_purchase: null });
  });

  it("getById indique qui a offert le billet reçu", async () => {
    ticketClient.send.mockImplementation((pattern: string) =>
      of(
        pattern === "ticket.transfers_by_ticket"
          ? [{ to_user_id: "buyer-1", status: "ACTIVE", from_first_name: "Jean", from_last_name: "Dupont", from_email: "jean@test.com", created_at: "2026-09-26" }]
          : pattern === "ticket.get"
            ? { id: "ticket-1", buyer_id: "buyer-1" }
            : [],
      ),
    );

    const result = await controller.getById(user, "ticket-1");

    expect(result.received_from).toEqual({ first_name: "Jean", last_name: "Dupont", email: "jean@test.com", at: "2026-09-26" });
  });

  it("getById rejette (autre acheteur, ex: ancien vendeur après une revente) — ne renvoie plus le billet d'un autre", async () => {
    ticketClient.send.mockReturnValue(of({ id: "ticket-1", buyer_id: "nouvel-acheteur" }));

    await expect(controller.getById(user, "ticket-1")).rejects.toThrow(ForbiddenException);
  });

  it("getByOrder renvoie les billets quand la commande appartient bien à l'appelant", async () => {
    orderClient.send.mockReturnValue(of({ order: { buyer_id: "buyer-1" } }));
    ticketClient.send.mockImplementation((pattern: string) =>
      of(
        pattern === "ticket.get_by_order"
          ? [
              { id: "ticket-1", buyer_id: "buyer-1" },
              { id: "ticket-2", buyer_id: "beneficiaire" },
            ]
          : [
              {
                ticket_id: "ticket-3",
                ticket_reference: "TKT-3",
                event_name: "Concert",
                ticket_category_name: "Standard",
                resale_price: "40.00",
                sold_at: "2026-09-26",
              },
            ],
      ),
    );

    const result = await controller.getByOrder(user, "order-1");

    // Billet offert depuis : toujours listé, marqué transféré. Billet revendu :
    // rattaché à la commande de l'acheteur, mais gardé en trace ici.
    expect(result).toEqual([
      { id: "ticket-1", buyer_id: "buyer-1", transferred: false },
      { id: "ticket-2", buyer_id: "beneficiaire", transferred: true },
      {
        id: "ticket-3",
        reference: "TKT-3",
        event_name: "Concert",
        ticket_category_name: "Standard",
        resold: true,
        resale_price: 40,
        sold_at: "2026-09-26",
      },
    ]);
  });

  it("getByOrder rejette si la commande appartient à quelqu'un d'autre", async () => {
    orderClient.send.mockReturnValue(of({ order: { buyer_id: "un-autre-acheteur" } }));

    await expect(controller.getByOrder(user, "order-1")).rejects.toThrow(ForbiddenException);
    expect(ticketClient.send).not.toHaveBeenCalled();
  });
});

describe("TicketController — téléchargement du PDF (bucket privé)", () => {
  const makeController = (ticket: object, readStoredFile = jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4"))) => {
    const ticketClient = { send: jest.fn().mockReturnValue(of(ticket)) };
    const adminClient = { send: jest.fn().mockReturnValue(of({})) };
    const controller = new TicketController(
      ticketClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      adminClient as any,
      {} as TicketsGateway,
      { readStoredFile } as any,
    );
    return { controller, readStoredFile, adminClient };
  };
  const res = () => ({ set: jest.fn(), send: jest.fn() });
  const req = { headers: { "x-forwarded-for": "203.0.113.7", "user-agent": "Test/1.0" }, ip: "10.0.0.1" };

  it("refuse le PDF d'un billet qui n'appartient pas à l'appelant, sans lire le fichier", async () => {
    const { controller, readStoredFile } = makeController({ buyer_id: "autre", pdf_url: "http://minio:9000/tickets/t.pdf", reference: "TKT-1" });
    await expect(
      controller.downloadPdf({ sub: "moi" } as any, "ticket-1", req as any, res() as any),
    ).rejects.toThrow("Ce billet ne vous appartient pas");
    expect(readStoredFile).not.toHaveBeenCalled();
  });

  it("sert le PDF au titulaire, en téléchargement non mis en cache", async () => {
    const { controller, readStoredFile } = makeController({ buyer_id: "moi", pdf_url: "http://minio:9000/tickets/t.pdf", reference: "TKT-1" });
    const response = res();
    await controller.downloadPdf({ sub: "moi" } as any, "ticket-1", req as any, response as any);
    expect(readStoredFile).toHaveBeenCalledWith("http://minio:9000/tickets/t.pdf");
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({ "Content-Type": "application/pdf", "Cache-Control": "no-store, private" }),
    );
    expect(response.send).toHaveBeenCalled();
  });

  it("journalise le téléchargement (qui, IP réelle, appareil), jamais un refus", async () => {
    const { controller, adminClient } = makeController({ buyer_id: "moi", pdf_url: "http://minio:9000/tickets/t.pdf", reference: "TKT-1" });
    await controller.downloadPdf({ sub: "moi", email: "moi@test.com" } as any, "ticket-1", req as any, res() as any);
    expect(adminClient.send).toHaveBeenCalledWith(
      "admin.log_action",
      expect.objectContaining({
        action: "TICKET_PDF_DOWNLOADED",
        entity_type: "TICKET",
        entity_id: "ticket-1",
        performed_by: "moi",
        ip_address: "203.0.113.7",
        metadata: expect.objectContaining({ reference: "TKT-1", user_agent: "Test/1.0" }),
      }),
    );

    const other = makeController({ buyer_id: "autre", pdf_url: "x", reference: "TKT-2" });
    await other.controller.downloadPdf({ sub: "moi" } as any, "ticket-2", req as any, res() as any).catch(() => undefined);
    expect(other.adminClient.send).not.toHaveBeenCalled();
  });
});

describe("TicketController — QR code sur demande uniquement", () => {
  let adminClient: { send: jest.Mock };
  const makeController = (ticket: object) => {
    const ticketClient = {
      send: jest.fn((pattern: string) =>
        of(
          pattern === "ticket.get_display_qr"
            ? { qr_code_url: "data:image/png;base64,DYNAMIQUE", refresh_in_seconds: 12 }
            : ticket,
        ),
      ),
    };
    adminClient = { send: jest.fn().mockReturnValue(of({ ticket_qr_display_seconds: 45 })) };
    return new TicketController(
      ticketClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      adminClient as any,
      {} as TicketsGateway,
      {} as any,
    );
  };
  const res = () => ({ set: jest.fn() });
  const req = { headers: { "user-agent": "Test/1.0" }, ip: "10.0.0.1" };

  it("fournit au titulaire le QR dynamique, la durée d'affichage et le délai de renouvellement", async () => {
    const controller = makeController({ buyer_id: "moi", status: "SENT" });
    await expect(controller.getQr({ sub: "moi" } as any, "t1", req as any, res() as any)).resolves.toEqual({
      qr_code_url: "data:image/png;base64,DYNAMIQUE",
      display_seconds: 45,
      refresh_in_seconds: 12,
    });
  });

  it("ne journalise qu'un accès par affichage, pas chaque renouvellement", async () => {
    const controller = makeController({ buyer_id: "moi", status: "SENT", reference: "TKT-1" });
    await controller.getQr({ sub: "moi" } as any, "t1", req as any, res() as any);
    await controller.getQr({ sub: "moi" } as any, "t1", req as any, res() as any, "1");
    const logs = adminClient.send.mock.calls.filter(([pattern]) => pattern === "admin.log_action");
    expect(logs).toHaveLength(1);
  });

  it("refuse le QR à un autre compte", async () => {
    const controller = makeController({ buyer_id: "autre", status: "SENT" });
    await expect(controller.getQr({ sub: "moi" } as any, "t1", req as any, res() as any)).rejects.toThrow("Ce billet ne vous appartient pas");
  });

  it.each(["USED", "FOR_RESALE", "CANCELLED", "REFUNDED"])("refuse le QR d'un billet %s", async (status) => {
    const controller = makeController({ buyer_id: "moi", status });
    await expect(controller.getQr({ sub: "moi" } as any, "t1", req as any, res() as any)).rejects.toThrow("aucun QR code");
  });
});

describe("TicketController — offrir un billet", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const recipient = {
    id: "marie",
    email: "marie@example.com",
    first_name: "Marie",
    last_name: "Martin",
    role: "BUYER",
    is_email_verified: true,
    is_active: true,
    is_suspended: false,
  };
  const ticket = {
    id: "t1",
    reference: "TKT-1",
    order_id: "o1",
    event_name: "Concert",
    event_start_at: "2026-12-01T20:00:00.000Z",
    event_venue_name: "Zénith",
    event_venue_address: "1 rue Test",
    event_city: "Paris",
    artist_name: "Artiste",
    ticket_category_name: "Standard",
    unit_price_ttc: "50.00",
    holder_first_name: "Paul",
    holder_last_name: "Martin",
    buyer_email: "marie@example.com",
  };
  const transfer = {
    id: "tr1",
    ticket_reference: "TKT-1",
    event_name: "Concert",
    from_email: "jean@example.com",
    from_holder_first_name: "Jean",
    from_holder_last_name: "Dupont",
    to_user_id: "marie",
    to_email: "marie@example.com",
    to_holder_first_name: "Paul",
    to_holder_last_name: "Martin",
    created_at: "2026-09-26T12:00:00.000Z",
  };
  const dto = { recipient_email: "marie@example.com", holder_first_name: "Paul", holder_last_name: "Martin" };
  const req = { headers: { "user-agent": "Test/1.0" }, ip: "10.0.0.1" };

  let ticketClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };
  let adminClient: { send: jest.Mock };
  let pdfClient: { emit: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let controller: TicketController;

  const build = (found: object | null = recipient) => {
    ticketClient = { send: jest.fn(() => of({ ticket, transfer })) };
    authClient = {
      send: jest.fn((pattern: string) =>
        of(
          pattern === "auth.find_by_email"
            ? found
            : { id: "jean", email: "jean@example.com", first_name: "Jean", last_name: "Dupont" },
        ),
      ),
    };
    adminClient = { send: jest.fn(() => of({ sensitive_action_reauth_minutes: 5 })) };
    pdfClient = { emit: jest.fn() };
    notifClient = { emit: jest.fn() };
    controller = new TicketController(
      ticketClient as any,
      {} as any,
      {} as any,
      {} as any,
      notifClient as any,
      authClient as any,
      {} as any,
      pdfClient as any,
      adminClient as any,
      {} as TicketsGateway,
      {} as any,
    );
  };

  it("exige une connexion récente (identifiants ressaisis)", async () => {
    build();
    const user = { sub: "jean", auth_time: now() - 3600 } as JwtPayload;
    await expect(controller.gift(user, "t1", dto, req as any)).rejects.toMatchObject({
      response: { code: "REAUTH_REQUIRED" },
    });
    expect(ticketClient.send).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistant", null],
    ["email non vérifié", { ...recipient, is_email_verified: false }],
    ["suspendu", { ...recipient, is_suspended: true }],
    ["administrateur", { ...recipient, role: "ADMIN" }],
  ])("refuse un bénéficiaire %s", async (_label, found) => {
    build(found);
    await expect(
      controller.gift({ sub: "jean", auth_time: now() } as JwtPayload, "t1", dto, req as any),
    ).rejects.toThrow("Aucun compte BilleTix actif et vérifié");
    expect(ticketClient.send).not.toHaveBeenCalled();
  });

  it("refuse de s'offrir son propre billet", async () => {
    build({ ...recipient, id: "jean" });
    await expect(
      controller.gift({ sub: "jean", auth_time: now() } as JwtPayload, "t1", dto, req as any),
    ).rejects.toThrow("propre billet");
  });

  it("transfère, régénère le PDF, journalise et prévient les deux parties", async () => {
    build();
    const result = await controller.gift({ sub: "jean", email: "jean@example.com", auth_time: now() } as JwtPayload, "t1", dto, req as any);

    expect(ticketClient.send).toHaveBeenCalledWith(
      "ticket.gift",
      expect.objectContaining({
        ticket_id: "t1",
        from_user_id: "jean",
        from_first_name: "Jean",
        to_user_id: "marie",
        to_holder_first_name: "Paul",
        ip_address: "10.0.0.1",
        user_agent: "Test/1.0",
      }),
    );
    expect(pdfClient.emit).toHaveBeenCalledWith("pdf.generate_ticket", expect.objectContaining({ holder_first_name: "Paul", unit_price_ttc: 50 }));
    expect(adminClient.send).toHaveBeenCalledWith(
      "admin.log_action",
      expect.objectContaining({
        action: "TICKET_TRANSFERRED",
        entity_id: "t1",
        metadata: expect.objectContaining({ to_email: "marie@example.com", holder_before: "Jean Dupont" }),
      }),
    );
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.ticket_transferred",
      expect.objectContaining({ senderEmail: "jean@example.com", recipientEmail: "marie@example.com" }),
    );
    expect(result).toMatchObject({ success: true, transfer: { to_email: "marie@example.com" } });
  });
});
