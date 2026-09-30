import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { AdminRecipients } from "../admin-alerts/admin-recipients.service";
import { CreditNoteIssuer } from "../credit-notes/credit-note-issuer.service";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "WON" | "LOST" | "CLOSED";

export interface DisputeSnapshot {
  id: string;
  payment_id: string;
  order_id: string;
  buyer_id: string;
  status: DisputeStatus;
  reason: string;
  description: string | null;
  stripe_dispute_id: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface OrderSnapshot {
  id: string;
  reference: string;
  status: string;
  buyer_id: string;
  buyer_email: string;
  buyer_first_name: string;
  buyer_last_name: string;
  organizer_id: string | null;
  event_id: string;
  event_name: string;
  event_start_at: string | null;
  total_amount_ttc: number | string;
  refunded_amount: number | string;
  payment_method: string;
  created_at: string;
}

export interface PaymentSnapshot {
  id: string;
  status: string;
  amount: number | string;
  refunded_amount: number | string | null;
  provider: string;
}

/** Contestation bancaire reçue par webhook Stripe (cf. payment-service). */
export interface StripeDisputeEvent {
  event: "created" | "closed";
  stripe_dispute_id: string;
  order_id: string | null;
  payment_id: string | null;
  reason: string;
  won: boolean;
  amount: number;
}

const PAID_ORDER_STATUSES = ["CONFIRMED", "TICKETS_SENT"];

/**
 * Cycle de vie d'un litige : ouverture par l'acheteur (sur SA commande payée)
 * ou par une contestation bancaire, examen et décision de l'admin (avec
 * remboursement éventuel), acheteur et organisateur prévenus à chaque étape.
 */
@Injectable()
export class DisputeWorkflow {
  private readonly logger = new Logger(DisputeWorkflow.name);

  constructor(
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    private readonly creditNotes: CreditNoteIssuer,
    private readonly adminRecipients: AdminRecipients,
  ) {}

  private async order(orderId: string): Promise<OrderSnapshot> {
    const { order } = await firstValueFrom(this.orderClient.send<{ order: OrderSnapshot }>("order.get", { id: orderId }));
    return order;
  }

  private payment(orderId: string): Promise<PaymentSnapshot | null> {
    return firstValueFrom(this.paymentClient.send<PaymentSnapshot>("payment.get_by_order", { order_id: orderId })).catch(
      () => null,
    );
  }

  // ─── Ouverture ────────────────────────────────────────────────────────────

  /**
   * L'acheteur signale un problème sur sa commande. Seul le titulaire d'une
   * commande payée peut le faire : un litige bloque le reversement de
   * l'organisateur, il ne doit pas pouvoir viser la commande d'un tiers.
   */
  async openByBuyer(buyerId: string, dto: { order_id: string; reason: string; description?: string }) {
    const order = await this.order(dto.order_id);
    if (order.buyer_id !== buyerId) throw new ForbiddenException("Cette commande ne vous appartient pas");
    if (!PAID_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException("Seule une commande payée et en cours de validité peut faire l'objet d'une réclamation.");
    }
    const payment = await this.payment(order.id);
    if (!payment || Number(order.total_amount_ttc) <= 0) {
      throw new BadRequestException("Une réservation gratuite ne peut pas faire l'objet d'une réclamation : contactez l'organisateur.");
    }
    const dispute = await firstValueFrom(
      this.paymentClient.send<DisputeSnapshot>("payment.create_dispute", {
        order_id: order.id,
        payment_id: payment.id,
        buyer_id: buyerId,
        reason: dto.reason,
        description: dto.description,
      }),
    );
    this.announceOpened(order, dispute, false);
    return dispute;
  }

  private announceOpened(order: OrderSnapshot, dispute: DisputeSnapshot, chargeback: boolean): void {
    this.notifyOrganizer(order, "notification.dispute_opened", { reason: dispute.reason });
    this.adminRecipients.noticeInBackground({
      subject: `${chargeback ? "Contestation bancaire" : "Nouvelle réclamation"} — commande ${order.reference}`,
      headline: chargeback ? "Contestation bancaire reçue" : "Nouvelle réclamation d'un acheteur",
      intro: chargeback
        ? "La banque d'un acheteur conteste un paiement. Le reversement de la commande est bloqué jusqu'à la décision."
        : "Un acheteur a signalé un problème sur sa commande. Le reversement de la commande est bloqué jusqu'à votre décision.",
      details: [
        `Commande : ${order.reference}`,
        `Événement : ${order.event_name}`,
        `Acheteur : ${order.buyer_first_name} ${order.buyer_last_name} (${order.buyer_email})`,
        ...(dispute.description ? [`Message : ${dispute.description}`] : []),
      ],
      ctaLabel: "Examiner le litige",
      ctaPath: `/admin/litiges/${dispute.id}`,
    });
  }

  /** Contestation bancaire (webhook Stripe) : ouverture, puis décision de la banque. */
  async handleStripeDispute(event: StripeDisputeEvent): Promise<void> {
    if (!event.order_id) {
      this.logger.warn(`Contestation ${event.stripe_dispute_id} sans commande connue : ignorée`);
      return;
    }
    const order = await this.order(event.order_id);

    if (event.event === "created") {
      // Webhook rejoué par Stripe : contestation déjà enregistrée, personne
      // n'est prévenu une seconde fois.
      const known = await firstValueFrom(
        this.paymentClient.send<DisputeSnapshot[]>("payment.get_disputes_by_order", { order_id: order.id }),
      );
      if (known.some((item) => item.stripe_dispute_id === event.stripe_dispute_id)) return;
      const dispute = await firstValueFrom(
        this.paymentClient.send<DisputeSnapshot>("payment.create_dispute", {
          order_id: order.id,
          payment_id: event.payment_id,
          buyer_id: order.buyer_id,
          reason: event.reason,
          description: `Contestation bancaire de ${event.amount.toFixed(2)} € (référence Stripe ${event.stripe_dispute_id}).`,
          stripe_dispute_id: event.stripe_dispute_id,
        }),
      );
      this.announceOpened(order, dispute, true);
      return;
    }

    const dispute = await firstValueFrom(
      this.paymentClient.send<DisputeSnapshot | null>("payment.close_stripe_dispute", {
        stripe_dispute_id: event.stripe_dispute_id,
        won: event.won,
      }),
    );
    if (!dispute) return;
    if (!event.won) {
      // Montant repris par la banque : même effet qu'un remboursement,
      // sans appel au prestataire (déjà débité).
      await firstValueFrom(this.paymentClient.send("payment.record_chargeback", { order_id: order.id, amount: event.amount }));
      await this.settleOrderAfterRefund(order, event.amount, "Contestation bancaire acceptée par la banque");
    }
    this.notifyOrganizer(order, "notification.dispute_resolved", {
      eventName: order.event_name,
      orderReference: order.reference,
      status: dispute.status,
      resolutionNotes: dispute.resolution_notes,
    });
  }

  // ─── Remboursement ────────────────────────────────────────────────────────

  /** Remboursement d'une commande (total si amountCents absent) : avoir, billets et commande à jour, acheteur prévenu. */
  async refundOrder(orderId: string, amountCents: number | undefined, reason: string): Promise<{ status: string; amount: number }> {
    const order = await this.order(orderId);
    const before = await this.payment(orderId);
    const alreadyRefunded = Number(before?.refunded_amount ?? 0);
    const result = await firstValueFrom(
      this.paymentClient.send<PaymentSnapshot>("payment.refund", { order_id: orderId, amount_cents: amountCents }),
    );
    const amount = amountCents ? amountCents / 100 : Number(result.amount) - alreadyRefunded;
    this.creditNotes.issueInBackground(orderId, amountCents ? amount : undefined, reason);
    await this.settleOrderAfterRefund(order, amount, reason, result.status === "REFUNDED");
    this.notifClient.emit("notification.refund_completed", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      orderReference: order.reference,
      eventName: order.event_name,
      amount: amount.toFixed(2),
      refundType: result.status === "REFUNDED" ? "Remboursement total" : "Remboursement partiel",
    });
    return { status: result.status, amount };
  }

  /**
   * Suite d'un remboursement : total, billets annulés et commande remboursée
   * (quota restitué) ; partiel, montant enregistré, billets toujours valables.
   */
  private async settleOrderAfterRefund(order: OrderSnapshot, amount: number, reason: string, full?: boolean): Promise<void> {
    const isFull = full ?? amount >= Number(order.total_amount_ttc) - Number(order.refunded_amount ?? 0) - 0.01;
    if (isFull) {
      await firstValueFrom(this.ticketClient.send("ticket.cancel_by_order", { order_id: order.id }));
      await firstValueFrom(this.orderClient.send("order.mark_refunded", { id: order.id }));
    } else {
      await firstValueFrom(this.orderClient.send("order.record_partial_refund", { id: order.id, amount_ttc: amount })).catch(
        (err) => this.logger.error(`Remboursement partiel non enregistré (${order.reference}) : ${(err as Error)?.message}`),
      );
    }
    this.logger.log(`Commande ${order.reference} : ${amount.toFixed(2)} € remboursés (${reason})`);
  }

  // ─── Examen et décision ───────────────────────────────────────────────────

  startReview(disputeId: string) {
    return firstValueFrom(this.paymentClient.send<DisputeSnapshot>("payment.start_dispute_review", { id: disputeId }));
  }

  /**
   * Décision de l'admin. LOST (acheteur dans son droit) peut s'accompagner
   * d'un remboursement, total ou partiel, effectué avant la clôture.
   */
  async resolve(
    adminId: string,
    disputeId: string,
    dto: { status: "WON" | "LOST" | "CLOSED"; resolution_notes?: string; refund_full?: boolean; refund_amount_cents?: number },
  ) {
    const current = await firstValueFrom(this.paymentClient.send<DisputeSnapshot>("payment.get_dispute", { id: disputeId }));
    if (current.status === "WON" || current.status === "LOST") throw new BadRequestException("Ce litige est déjà tranché.");

    let refunded: number | null = null;
    if (dto.status === "LOST" && (dto.refund_full || dto.refund_amount_cents)) {
      const refund = await this.refundOrder(
        current.order_id,
        dto.refund_full ? undefined : dto.refund_amount_cents,
        dto.resolution_notes?.trim() || "Réclamation de l'acheteur acceptée",
      );
      refunded = refund.amount;
    }

    const dispute = await firstValueFrom(
      this.paymentClient.send<DisputeSnapshot>("payment.resolve_dispute", {
        id: disputeId,
        status: dto.status,
        resolution_notes: dto.resolution_notes,
        resolved_by: adminId,
      }),
    );
    const order = await this.order(dispute.order_id);
    this.notifyOrganizer(order, "notification.dispute_resolved", {
      eventName: order.event_name,
      orderReference: order.reference,
      status: dto.status,
      resolutionNotes: dto.resolution_notes ?? null,
    });
    this.notifClient.emit("notification.dispute_resolved_buyer", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      eventName: order.event_name,
      orderReference: order.reference,
      status: dto.status,
      resolutionNotes: dto.resolution_notes ?? null,
      ...(refunded ? { refundAmount: refunded.toFixed(2) } : {}),
    });
    return dispute;
  }

  // ─── Consultation (admin) ─────────────────────────────────────────────────

  /** Liste admin : chaque litige avec sa commande, son événement et son acheteur. */
  async listForAdmin() {
    const disputes = await firstValueFrom(this.paymentClient.send<DisputeSnapshot[]>("payment.get_all_disputes", {}));
    const orders = await Promise.all(
      [...new Set(disputes.map((dispute) => dispute.order_id))].map((id) => this.order(id).catch(() => null)),
    );
    const byId = new Map(orders.filter((order): order is OrderSnapshot => order !== null).map((order) => [order.id, order]));
    return disputes.map((dispute) => {
      const order = byId.get(dispute.order_id);
      return {
        ...dispute,
        order_reference: order?.reference ?? null,
        event_name: order?.event_name ?? null,
        buyer_name: order ? `${order.buyer_first_name} ${order.buyer_last_name}` : null,
        amount_ttc: order ? Number(order.total_amount_ttc) : null,
      };
    });
  }

  /** Fiche d'un litige : commande, billets, paiement et avoirs, pour décider en connaissance de cause. */
  async detail(disputeId: string) {
    const dispute = await firstValueFrom(this.paymentClient.send<DisputeSnapshot>("payment.get_dispute", { id: disputeId }));
    const [order, tickets, payment, creditNotes] = await Promise.all([
      this.order(dispute.order_id),
      firstValueFrom(
        this.ticketClient.send<
          Array<{ id: string; reference: string; status: string; holder_first_name: string; holder_last_name: string; ticket_category_name: string }>
        >("ticket.get_by_order", { order_id: dispute.order_id }),
      ).catch(() => []),
      this.payment(dispute.order_id),
      firstValueFrom(
        this.orderClient.send<Array<{ number: string; amount_ttc: string; reason: string; created_at: string }>>("order.list_credit_notes", {
          order_id: dispute.order_id,
        }),
      ).catch(() => []),
    ]);
    return {
      dispute,
      order: {
        id: order.id,
        reference: order.reference,
        status: order.status,
        event_id: order.event_id,
        event_name: order.event_name,
        event_start_at: order.event_start_at,
        total_amount_ttc: Number(order.total_amount_ttc),
        refunded_amount: Number(order.refunded_amount ?? 0),
        payment_method: order.payment_method,
        buyer_id: order.buyer_id,
        buyer_name: `${order.buyer_first_name} ${order.buyer_last_name}`,
        buyer_email: order.buyer_email,
        created_at: order.created_at,
      },
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        reference: ticket.reference,
        status: ticket.status,
        holder: `${ticket.holder_first_name} ${ticket.holder_last_name}`,
        category: ticket.ticket_category_name,
      })),
      payment: payment
        ? {
            status: payment.status,
            amount: Number(payment.amount),
            refunded_amount: Number(payment.refunded_amount ?? 0),
            provider: payment.provider,
          }
        : null,
      credit_notes: creditNotes.map((note) => ({ ...note, amount_ttc: Number(note.amount_ttc) })),
    };
  }

  private notifyOrganizer(order: OrderSnapshot, pattern: string, extra: Record<string, unknown>): void {
    if (!order.organizer_id) return;
    firstValueFrom(this.authClient.send<{ email: string; first_name: string } | null>("auth.get_user", { id: order.organizer_id }))
      .then((organizer) => {
        if (!organizer?.email) return;
        this.notifClient.emit(pattern, {
          email: organizer.email,
          firstName: organizer.first_name,
          eventName: order.event_name,
          orderReference: order.reference,
          ...extra,
        });
      })
      .catch(() => undefined);
  }
}
