import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { formatEventDate, formatEventSchedule } from "../common/event-date";

/** Événement tel que renvoyé par event-service, champs du report compris. */
export interface PostponedEvent {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  timezone?: string | null;
  postponed_at: string | null;
  postponement_reason: string | null;
  original_start_date: string | null;
  rescheduled_at: string | null;
}

interface HeldTicket {
  order_id: string;
  buyer_id: string;
  buyer_email: string;
  holder_first_name: string;
  status: string;
}

interface OrderSnapshot {
  id: string;
  event_id: string;
  buyer_id: string;
  buyer_email: string;
  buyer_first_name: string;
  reference: string;
  status: string;
  is_resale: boolean;
  total_amount_ttc: number | string;
}

// Billets encore détenus (un billet en revente appartient toujours à son vendeur).
const HELD_STATUSES = ["GENERATED", "SENT", "FOR_RESALE"];
// Billets qu'une demande de remboursement peut annuler.
const REFUNDABLE_TICKET_STATUSES = ["GENERATED", "SENT"];
const PAID_ORDER_STATUSES = ["CONFIRMED", "TICKETS_SENT"];
const DAY_MS = 24 * 3600 * 1000;

/**
 * Conséquences d'un report accepté : billets et commandes à la nouvelle date,
 * détenteurs prévenus ; puis remboursement d'une commande à la demande de
 * son acheteur, tant que la date est à venir ou pendant le délai réglé par
 * l'admin (postponement_refund_days) après l'annonce de la nouvelle date.
 */
@Injectable()
export class EventPostponementService {
  private readonly logger = new Logger(EventPostponementService.name);

  constructor(
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
  ) {}

  /** Fin du délai de remboursement ; null tant que la nouvelle date est à venir (remboursement ouvert). */
  async refundDeadline(event: PostponedEvent): Promise<Date | null> {
    if (!event.postponed_at || event.status === "POSTPONED" || !event.rescheduled_at) return null;
    const config = await firstValueFrom(
      this.adminClient.send<{ postponement_refund_days: number }>("admin.get_platform_config", {}),
    );
    return new Date(new Date(event.rescheduled_at).getTime() + config.postponement_refund_days * DAY_MS);
  }

  /** Report accepté (POSTPONED) ou nouvelle date fixée (RESCHEDULED), sans bloquer la réponse. */
  announceInBackground(event: PostponedEvent, announcement: "POSTPONED" | "RESCHEDULED"): void {
    this.announce(event, announcement).catch((err) =>
      this.logger.error(`Annonce du report de l'événement ${event.id} : ${(err as Error)?.message}`),
    );
  }

  private async announce(event: PostponedEvent, announcement: "POSTPONED" | "RESCHEDULED"): Promise<void> {
    if (event.status !== "POSTPONED") {
      const dates = { event_id: event.id, event_start_at: event.start_date, event_end_at: event.end_date };
      await Promise.all([
        firstValueFrom(this.ticketClient.send("ticket.sync_event_dates", dates)),
        firstValueFrom(this.orderClient.send("order.sync_event_dates", dates)),
      ]);
    }

    const [tickets, orders, deadline] = await Promise.all([
      firstValueFrom(this.ticketClient.send<HeldTicket[]>("ticket.get_by_event", { event_id: event.id })),
      firstValueFrom(this.orderClient.send<OrderSnapshot[]>("order.list_by_event", { event_id: event.id })),
      this.refundDeadline(event),
    ]);
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const timezone = event.timezone ?? null;
    const notified = new Set<string>();

    // Un email par détenteur de billet (un billet offert est annoncé à son
    // nouveau détenteur) ; le remboursement n'est proposé qu'à l'acheteur.
    for (const ticket of tickets) {
      if (!HELD_STATUSES.includes(ticket.status)) continue;
      const email = ticket.buyer_email.toLowerCase();
      if (notified.has(email)) continue;
      notified.add(email);
      const order = orderById.get(ticket.order_id);
      const refundable =
        !!order && order.buyer_id === ticket.buyer_id && !order.is_resale && PAID_ORDER_STATUSES.includes(order.status);
      this.notifClient.emit("notification.event_postponed", {
        email: ticket.buyer_email,
        firstName: ticket.holder_first_name,
        eventName: event.title,
        announcement,
        originalDate: formatEventDate(event.original_start_date ?? event.start_date, timezone),
        newDate: event.status === "POSTPONED" ? undefined : formatEventSchedule(event.start_date, timezone),
        reason: event.postponement_reason ?? undefined,
        refundDeadline: deadline ? formatEventDate(deadline, timezone) : undefined,
        refundable,
      });
    }
    this.logger.log(`Report de l'événement ${event.id} (${announcement}) : ${notified.size} détenteur(s) prévenu(s)`);
  }

  /** Remboursement possible pour cette commande ? Motif du refus sinon. */
  async refundStatus(
    orderId: string,
    userId: string,
  ): Promise<{ postponed: boolean; available: boolean; deadline: string | null; message: string | null }> {
    const { event, message, deadline } = await this.check(orderId, userId);
    return {
      postponed: !!event.postponed_at,
      available: message === null,
      deadline: deadline?.toISOString() ?? null,
      message,
    };
  }

  /** L'acheteur renonce à la nouvelle date : commande remboursée, billets annulés. */
  async refund(orderId: string, userId: string): Promise<{ refunded: true; amount: number }> {
    const { order, event, message } = await this.check(orderId, userId);
    if (message) throw new BadRequestException(message);

    const amount = Number(order.total_amount_ttc);
    // Paiement d'abord : un échec laisse la commande et les billets intacts.
    if (amount > 0) await firstValueFrom(this.paymentClient.send("payment.refund", { order_id: order.id }));
    await firstValueFrom(this.ticketClient.send("ticket.cancel_by_order", { order_id: order.id }));
    await firstValueFrom(this.orderClient.send("order.mark_refunded", { id: order.id }));
    if (amount > 0) {
      this.notifClient.emit("notification.refund_completed", {
        email: order.buyer_email,
        firstName: order.buyer_first_name,
        orderReference: order.reference,
        eventName: event.title,
        amount: amount.toFixed(2),
        refundType: "Remboursement après le report de l'événement",
      });
    }
    return { refunded: true, amount };
  }

  private async check(orderId: string, userId: string) {
    const { order } = await firstValueFrom(this.orderClient.send<{ order: OrderSnapshot }>("order.get", { id: orderId }));
    if (order.buyer_id !== userId) throw new ForbiddenException("Cette commande ne vous appartient pas");

    const [event, tickets] = await Promise.all([
      firstValueFrom(this.eventClient.send<PostponedEvent>("event.get", { id: order.event_id })),
      firstValueFrom(this.ticketClient.send<HeldTicket[]>("ticket.get_by_order", { order_id: order.id })),
    ]);
    const deadline = await this.refundDeadline(event);
    return { order, event, deadline, message: this.refusal(order, event, tickets, userId, deadline) };
  }

  private refusal(
    order: OrderSnapshot,
    event: PostponedEvent,
    tickets: HeldTicket[],
    userId: string,
    deadline: Date | null,
  ): string | null {
    if (!event.postponed_at) return "Cet événement n'a pas été reporté.";
    if (event.status === "CANCELLED") return "Cet événement est annulé : les acheteurs sont remboursés automatiquement.";
    if (order.is_resale) {
      return "Un billet acheté en revente n'est pas remboursé après un report : vous pouvez le remettre en vente si la nouvelle date ne vous convient pas.";
    }
    if (!PAID_ORDER_STATUSES.includes(order.status)) return "Cette commande n'est pas remboursable dans son état actuel.";
    if (event.status !== "POSTPONED") {
      if (new Date(event.start_date).getTime() <= Date.now()) return "L'événement a déjà commencé.";
      if (!deadline || Date.now() > deadline.getTime()) {
        return "Le délai pour demander le remboursement après le report est dépassé.";
      }
    }
    if (tickets.some((ticket) => ticket.buyer_id !== userId || !REFUNDABLE_TICKET_STATUSES.includes(ticket.status))) {
      return "Un billet de cette commande a été offert, mis en revente ou utilisé : la commande ne peut plus être remboursée.";
    }
    return null;
  }
}
