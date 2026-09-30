import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { DisputeWorkflow } from "./dispute-workflow.service";

describe("DisputeWorkflow — litiges", () => {
  let order: Record<string, unknown>;
  let payment: Record<string, unknown> | null;
  let dispute: Record<string, unknown>;
  let clients: Record<string, { send: jest.Mock; emit: jest.Mock }>;
  let creditNotes: { issueInBackground: jest.Mock };
  let admins: { noticeInBackground: jest.Mock };
  let workflow: DisputeWorkflow;

  const client = (answer: (pattern: string, data: Record<string, unknown>) => unknown) => ({
    send: jest.fn((pattern: string, data: Record<string, unknown>) => {
      const value = answer(pattern, data);
      return value instanceof Error ? throwError(() => value) : of(value);
    }),
    emit: jest.fn(),
  });

  beforeEach(() => {
    order = {
      id: "order-1",
      reference: "ORD-1",
      status: "TICKETS_SENT",
      buyer_id: "buyer-1",
      buyer_email: "jean@example.com",
      buyer_first_name: "Jean",
      buyer_last_name: "Dupont",
      organizer_id: null,
      event_name: "Soirée Jazz",
      total_amount_ttc: "60.00",
      refunded_amount: "0",
    };
    payment = { id: "pay-1", status: "PAID", amount: "60.00", refunded_amount: null, provider: "STRIPE" };
    dispute = { id: "dispute-1", order_id: "order-1", status: "UNDER_REVIEW", reason: "GENERAL", description: null };
    clients = {
      payment: client((pattern, data) => {
        if (pattern === "payment.get_by_order") return payment ?? new Error("introuvable");
        if (pattern === "payment.refund") return { ...payment, status: data.amount_cents ? "PARTIALLY_REFUNDED" : "REFUNDED" };
        if (pattern === "payment.resolve_dispute") return { ...dispute, status: data.status };
        if (pattern === "payment.get_disputes_by_order") return [dispute];
        return dispute;
      }),
      order: client(() => ({ order })),
      ticket: client(() => ({ cancelled_count: 2 })),
      auth: client(() => null),
      notif: client(() => undefined),
    };
    creditNotes = { issueInBackground: jest.fn() };
    admins = { noticeInBackground: jest.fn() };
    workflow = new DisputeWorkflow(
      clients.payment as never,
      clients.order as never,
      clients.ticket as never,
      clients.auth as never,
      clients.notif as never,
      creditNotes as never,
      admins as never,
    );
  });

  it("ouverture : le paiement est déduit de la commande de l'acheteur, les admins sont prévenus", async () => {
    await workflow.openByBuyer("buyer-1", { order_id: "order-1", reason: "PRODUCT_NOT_RECEIVED" });
    expect(clients.payment.send).toHaveBeenCalledWith(
      "payment.create_dispute",
      expect.objectContaining({ order_id: "order-1", payment_id: "pay-1", buyer_id: "buyer-1" }),
    );
    expect(admins.noticeInBackground).toHaveBeenCalledWith(expect.objectContaining({ ctaPath: "/admin/litiges/dispute-1" }));
  });

  it("ouverture sur la commande d'un autre compte : interdit", async () => {
    await expect(workflow.openByBuyer("intrus", { order_id: "order-1", reason: "GENERAL" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(clients.payment.send).not.toHaveBeenCalledWith("payment.create_dispute", expect.anything());
  });

  it("ouverture sur une commande non payée ou gratuite : refusée", async () => {
    order.status = "PENDING_PAYMENT";
    await expect(workflow.openByBuyer("buyer-1", { order_id: "order-1", reason: "GENERAL" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    order.status = "CONFIRMED";
    payment = null;
    await expect(workflow.openByBuyer("buyer-1", { order_id: "order-1", reason: "GENERAL" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("décision en faveur de l'acheteur avec remboursement total : billets annulés, avoir, acheteur prévenu", async () => {
    await workflow.resolve("admin-1", "dispute-1", { status: "LOST", refund_full: true, resolution_notes: "Billet jamais reçu" });
    expect(clients.payment.send).toHaveBeenCalledWith("payment.refund", { order_id: "order-1", amount_cents: undefined });
    expect(clients.ticket.send).toHaveBeenCalledWith("ticket.cancel_by_order", { order_id: "order-1" });
    expect(clients.order.send).toHaveBeenCalledWith("order.mark_refunded", { id: "order-1" });
    expect(creditNotes.issueInBackground).toHaveBeenCalledWith("order-1", undefined, "Billet jamais reçu");
    expect(clients.notif.emit).toHaveBeenCalledWith(
      "notification.dispute_resolved_buyer",
      expect.objectContaining({ status: "LOST", refundAmount: "60.00" }),
    );
  });

  it("réclamation rejetée : aucun remboursement", async () => {
    await workflow.resolve("admin-1", "dispute-1", { status: "WON", resolution_notes: "Billet scanné à l'entrée" });
    expect(clients.payment.send).not.toHaveBeenCalledWith("payment.refund", expect.anything());
    expect(clients.notif.emit).toHaveBeenCalledWith("notification.dispute_resolved_buyer", expect.objectContaining({ status: "WON" }));
  });

  it("litige déjà tranché : refusé", async () => {
    dispute.status = "LOST";
    await expect(workflow.resolve("admin-1", "dispute-1", { status: "WON" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("contestation bancaire perdue : montant repris enregistré, billets annulés", async () => {
    await workflow.handleStripeDispute({
      event: "closed",
      stripe_dispute_id: "dp_1",
      order_id: "order-1",
      payment_id: "pay-1",
      reason: "FRAUDULENT",
      won: false,
      amount: 60,
    });
    expect(clients.payment.send).toHaveBeenCalledWith("payment.record_chargeback", { order_id: "order-1", amount: 60 });
    expect(clients.ticket.send).toHaveBeenCalledWith("ticket.cancel_by_order", { order_id: "order-1" });
  });

  it("contestation bancaire rejouée par Stripe : ni nouveau litige, ni nouvelle alerte", async () => {
    dispute.stripe_dispute_id = "dp_1";
    await workflow.handleStripeDispute({
      event: "created",
      stripe_dispute_id: "dp_1",
      order_id: "order-1",
      payment_id: "pay-1",
      reason: "FRAUDULENT",
      won: false,
      amount: 60,
    });
    expect(clients.payment.send).not.toHaveBeenCalledWith("payment.create_dispute", expect.anything());
    expect(admins.noticeInBackground).not.toHaveBeenCalled();
  });
});
