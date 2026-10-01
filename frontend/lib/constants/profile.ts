import { msg } from "@/lib/i18n/translate";
// Types et libellés d'affichage des billets et commandes du profil.

export type TicketStatus = "valid" | "used" | "for_resale" | "cancelled";

export interface ProfileTicket {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  emoji: string;
  iconBg: string;
  status: TicketStatus;
  // Billet reçu en cadeau : « Reçu de Jean D. »
  receivedFromLabel?: string;
  // Billet acheté en revente : « Acheté en revente le 26 septembre 2026 »
  resalePurchaseLabel?: string;
}

// Statuts affichés, alignés sur ceux d'order-service.
export type OrderStatus = "sent" | "used" | "pending" | "cancelled" | "refunded";

export interface ProfileOrder {
  id?: string;
  reference: string;
  // Événement concerné (recherche dans « Mes commandes »).
  eventName?: string;
  amountLabel: string;
  dateLabel: string;
  ticketCountLabel: string;
  status: OrderStatus;
}

export const ticketStatusBadge: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "✓ Valide",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  used: {
    label: msg("Utilisé"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  for_resale: {
    label: msg("En revente"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  cancelled: {
    label: msg("Annulé"),
    className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
  },
};

export const orderStatusBadge: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  sent: {
    label: msg("Billets envoyés"),
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  used: {
    label: msg("Utilisé"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  pending: {
    label: msg("Paiement en attente"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  cancelled: {
    label: msg("Annulée"),
    className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
  },
  refunded: {
    label: msg("Remboursée"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
};

