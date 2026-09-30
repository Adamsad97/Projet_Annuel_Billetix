import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { of } from "rxjs";
import { EventPostponementService } from "./event-postponement.service";

const DAY = 24 * 3600 * 1000;

describe("EventPostponementService — remboursement après un report", () => {
  let order: Record<string, unknown>;
  let event: Record<string, unknown>;
  let tickets: Array<Record<string, unknown>>;
  let clients: Record<string, { send: jest.Mock; emit: jest.Mock }>;
  let service: EventPostponementService;

  const client = (answer: (pattern: string, data: unknown) => unknown) => ({
    send: jest.fn((pattern: string, data: unknown) => of(answer(pattern, data))),
    emit: jest.fn(),
  });

  beforeEach(() => {
    order = {
      id: "order-1",
      event_id: "event-1",
      buyer_id: "buyer-1",
      buyer_email: "jean@example.com",
      buyer_first_name: "Jean",
      reference: "ORD-1",
      status: "TICKETS_SENT",
      is_resale: false,
      total_amount_ttc: "45.00",
    };
    event = {
      id: "event-1",
      title: "Soirée Jazz",
      status: "POSTPONED",
      start_date: new Date(Date.now() + 10 * DAY).toISOString(),
      end_date: new Date(Date.now() + 10 * DAY + 3600_000).toISOString(),
      postponed_at: new Date().toISOString(),
      postponement_reason: "Intempéries",
      original_start_date: new Date(Date.now() + 5 * DAY).toISOString(),
      rescheduled_at: null,
    };
    tickets = [{ order_id: "order-1", buyer_id: "buyer-1", buyer_email: "jean@example.com", holder_first_name: "Jean", status: "SENT" }];
    clients = {
      event: client(() => event),
      order: client((pattern) => (pattern === "order.get" ? { order } : { success: true })),
      payment: client(() => ({ status: "REFUNDED" })),
      ticket: client((pattern) => (pattern === "ticket.get_by_order" ? tickets : { cancelled_count: 1 })),
      notif: client(() => undefined),
      admin: client(() => ({ postponement_refund_days: 14 })),
    };
    service = new EventPostponementService(
      clients.event as never,
      clients.order as never,
      clients.payment as never,
      clients.ticket as never,
      clients.notif as never,
      clients.admin as never,
    );
  });

  it("date à venir : remboursement ouvert, commande remboursée puis billets annulés", async () => {
    await expect(service.refundStatus("order-1", "buyer-1")).resolves.toEqual({ postponed: true, available: true, deadline: null, message: null });
    await expect(service.refund("order-1", "buyer-1")).resolves.toEqual({ refunded: true, amount: 45 });
    expect(clients.payment.send).toHaveBeenCalledWith("payment.refund", { order_id: "order-1" });
    expect(clients.ticket.send).toHaveBeenCalledWith("ticket.cancel_by_order", { order_id: "order-1" });
    expect(clients.order.send).toHaveBeenCalledWith("order.mark_refunded", { id: "order-1" });
    expect(clients.notif.emit).toHaveBeenCalledWith("notification.refund_completed", expect.objectContaining({ amount: "45.00" }));
  });

  it("nouvelle date annoncée : remboursement possible pendant le délai réglé par l'admin", async () => {
    const announced = new Date(Date.now() - 3 * DAY);
    event = { ...event, status: "PUBLISHED", rescheduled_at: announced.toISOString() };
    const status = await service.refundStatus("order-1", "buyer-1");
    expect(status.available).toBe(true);
    expect(status.deadline).toBe(new Date(announced.getTime() + 14 * DAY).toISOString());
  });

  it("délai dépassé : refusé", async () => {
    event = { ...event, status: "PUBLISHED", rescheduled_at: new Date(Date.now() - 20 * DAY).toISOString() };
    await expect(service.refund("order-1", "buyer-1")).rejects.toBeInstanceOf(BadRequestException);
    expect(clients.payment.send).not.toHaveBeenCalled();
  });

  it("billet offert ou mis en revente : refusé", async () => {
    tickets = [{ ...tickets[0], buyer_id: "ami-1" }];
    const status = await service.refundStatus("order-1", "buyer-1");
    expect(status.available).toBe(false);
    expect(status.message).toContain("offert");
  });

  it("commande de revente : refusée", async () => {
    order = { ...order, is_resale: true };
    expect((await service.refundStatus("order-1", "buyer-1")).available).toBe(false);
  });

  it("événement non reporté : refusé", async () => {
    event = { ...event, status: "PUBLISHED", postponed_at: null };
    expect((await service.refundStatus("order-1", "buyer-1")).message).toContain("pas été reporté");
  });

  it("commande d'un autre compte : interdit", async () => {
    await expect(service.refundStatus("order-1", "intrus")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("réservation gratuite : billets libérés sans paiement ni email de remboursement", async () => {
    order = { ...order, total_amount_ttc: "0.00" };
    await service.refund("order-1", "buyer-1");
    expect(clients.payment.send).not.toHaveBeenCalled();
    expect(clients.notif.emit).not.toHaveBeenCalled();
    expect(clients.ticket.send).toHaveBeenCalledWith("ticket.cancel_by_order", { order_id: "order-1" });
  });
});
