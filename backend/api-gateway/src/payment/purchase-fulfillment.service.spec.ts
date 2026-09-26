import { of } from "rxjs";
import { PurchaseFulfillmentService } from "./purchase-fulfillment.service";

// Instanciation directe (pas de TestingModule) : aucun test existant pour ce
// service, et seule la branche revente est visée ici.
describe("PurchaseFulfillmentService — commande de revente (bug webhook)", () => {
  let service: PurchaseFulfillmentService;
  let paymentClient: { send: jest.Mock };
  let orderClient: { send: jest.Mock };
  let ticketClient: { send: jest.Mock };
  let pdfClient: { emit: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let adminClient: { send: jest.Mock };
  let eventClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };
  let ticketsGateway: { notifyDashboardUpdate: jest.Mock };

  const baseOrder = {
    id: "order-1",
    reference: "ORD-2026-00001",
    buyer_id: "buyer-1",
    buyer_email: "jean@test.com",
    buyer_first_name: "Jean",
    buyer_last_name: "Dupont",
    total_amount_ht: 10,
    total_amount_ttc: 12,
    total_commission: 1,
    total_payment_fees: 0.5,
    discount_amount: 0,
    free_ticket_fees: 0,
    organizer_id: "organizer-1",
    event_id: "event-1",
    event_name: "Concert Test",
    event_start_at: new Date().toISOString(),
    event_venue_name: "Zenith",
    event_venue_address: "1 rue Test",
    event_city: "Paris",
    payment_method: "STRIPE",
  };

  beforeEach(() => {
    paymentClient = { send: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };
    orderClient = { send: jest.fn() };
    ticketClient = { send: jest.fn() };
    pdfClient = { emit: jest.fn() };
    notifClient = { emit: jest.fn() };
    adminClient = { send: jest.fn(() => of({})) };
    eventClient = {
      send: jest.fn().mockReturnValue(of({ is_first_sale: false })),
    };
    authClient = { send: jest.fn() };
    ticketsGateway = { notifyDashboardUpdate: jest.fn() };

    service = new PurchaseFulfillmentService(
      paymentClient as any,
      orderClient as any,
      ticketClient as any,
      pdfClient as any,
      notifClient as any,
      adminClient as any,
      eventClient as any,
      authClient as any,
      ticketsGateway as any,
      { readStoredFile: jest.fn().mockResolvedValue(Buffer.from("%PDF")) } as any,
    );
  });

  it("revente : pas de nouveau billet, mais facture et reversement organisateur", async () => {
    orderClient.send.mockImplementation((pattern: string) => {
      if (pattern === "order.get") {
        return of({ order: { ...baseOrder, is_resale: true }, items: [] });
      }
      return of({});
    });

    await service.confirmAndFulfill("order-1", "pi_123");

    expect(ticketClient.send).not.toHaveBeenCalledWith(
      "ticket.generate",
      expect.anything(),
    );
    // Plus de billet PDF : la facture est la preuve d'achat, revente comprise.
    expect(pdfClient.emit).toHaveBeenCalledWith("pdf.generate_invoice", expect.objectContaining({ order_id: "order-1" }));
    expect(pdfClient.emit).not.toHaveBeenCalledWith("pdf.generate_ticket", expect.anything());
    expect(notifClient.emit).not.toHaveBeenCalledWith(
      "notification.ticket_ready",
      expect.anything(),
    );
    expect(paymentClient.send).toHaveBeenCalledWith(
      "payment.create_payout",
      expect.objectContaining({ order_id: "order-1", organizer_id: "organizer-1" }),
    );
  });

  it("génère bien les billets pour une commande normale (non-revente)", async () => {
    orderClient.send.mockImplementation((pattern: string) => {
      if (pattern === "order.get") {
        return of({ order: { ...baseOrder, is_resale: false }, items: [] });
      }
      return of({});
    });
    ticketClient.send.mockImplementation((pattern: string) => {
      if (pattern === "ticket.generate") return of([]);
      return of({});
    });

    await service.confirmAndFulfill("order-1", "pi_123");

    expect(ticketClient.send).toHaveBeenCalledWith(
      "ticket.generate",
      expect.objectContaining({ order_id: "order-1" }),
    );
    expect(pdfClient.emit).toHaveBeenCalledWith("pdf.generate_invoice", expect.anything());
    expect(pdfClient.emit).not.toHaveBeenCalledWith("pdf.generate_ticket", expect.anything());
    expect(paymentClient.send).toHaveBeenCalledWith(
      "payment.create_payout",
      expect.objectContaining({ order_id: "order-1" }),
    );
  });
});
