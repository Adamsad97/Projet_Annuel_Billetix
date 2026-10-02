import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

export type AdminAlert = {
  type: "mass_refunds" | "dispute_spike" | "duplicate_scan";
  severity: "warning" | "critical";
  data: { count?: number; threshold?: number; ticket_id?: string; event_id?: string };
};

/** Publie dans RabbitMQ les événements temps réel, relayés aux navigateurs par realtime-service. */
@Injectable()
export class RealtimePublisher {
  constructor(@Inject("REALTIME_SERVICE") private readonly client: ClientProxy) {}

  /** Billet scanné à l'entrée : son titulaire est prévenu en direct. */
  ticketScanned(holderId: string, ticket: { ticket_id: string; event_name: string; ticket_category_name: string; scanned_at: Date | string }) {
    this.client.emit("realtime.ticket_scanned", {
      holder_id: holderId,
      ...ticket,
      scanned_at: new Date(ticket.scanned_at).toISOString(),
    });
  }

  /** Vente ou entrée : le tableau de bord ouvert sur l'événement se rafraîchit. */
  dashboardChanged(eventId: string, reason: "sale" | "scan") {
    this.client.emit("realtime.dashboard_changed", { event_id: eventId, reason });
  }

  /** Seuil d'alerte franchi : prévient les admins connectés. */
  adminAlert(alert: AdminAlert) {
    this.client.emit("realtime.admin_alert", alert);
  }
}
