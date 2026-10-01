import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { Order, OrderStatus } from "./types/order-snapshot.type";
import { CreditNoteIssuer } from "../credit-notes/credit-note-issuer.service";

export interface CancelledEventSnapshot {
  id: string;
  title: string;
  start_date: string;
  venue_name: string;
}

/** Conséquences d'une annulation : billets annulés, commandes remboursées, acheteurs prévenus. */
@Injectable()
export class EventRefundService {
  private readonly logger = new Logger(EventRefundService.name);

  constructor(
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    private readonly creditNotes: CreditNoteIssuer,
  ) {}

  /** Lance la cascade sans bloquer la réponse (erreurs journalisées). */
  refundInBackground(event: CancelledEventSnapshot, cancellationReason?: string): void {
    this.refundAllOrdersForEvent(event, cancellationReason).catch((err) =>
      this.logger.error(`Erreur cascade remboursement event ${event.id}: ${err?.message}`),
    );
  }

  async refundAllOrdersForEvent(event: CancelledEventSnapshot, cancellationReason?: string): Promise<void> {
    const orders = (await firstValueFrom(
      this.orderClient.send("order.list_by_event", { event_id: event.id }),
    )) as Order[];

    const paidOrders = orders.filter(
      (order) => order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.TICKETS_SENT,
    );

    // Annulation en masse des billets (une seule requête)
    if (paidOrders.length > 0) {
      await firstValueFrom(this.ticketClient.send("ticket.cancel_by_event", { event_id: event.id }));
    }

    // Remboursement individuel par commande
    for (const order of paidOrders) {
      try {
        await firstValueFrom(this.paymentClient.send("payment.refund", { order_id: order.id }));
        await firstValueFrom(this.orderClient.send("order.mark_refunded", { id: order.id }));
        this.creditNotes.issueInBackground(
          order.id,
          undefined,
          cancellationReason ? `Annulation de l'événement : ${cancellationReason}` : "Annulation de l'événement",
        );
        this.notifClient.emit("notification.event_canceled", {
          email: order.buyer_email,
          firstName: order.buyer_first_name,
          eventName: event.title,
          eventDate: event.start_date,
          eventVenue: event.venue_name,
          refundAmount: Number(order.total_amount_ttc).toFixed(2),
          cancellationReason,
        });
      } catch (refundError) {
        this.logger.error(`Échec remboursement commande ${order.id}: ${(refundError as Error)?.message}`);
      }
    }

    this.logger.log(`Cascade annulation event ${event.id} : ${paidOrders.length} commande(s) remboursée(s)`);
  }
}
