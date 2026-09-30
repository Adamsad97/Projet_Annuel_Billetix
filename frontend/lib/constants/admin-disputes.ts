// Libellés et filtres des litiges (payment-service).

import type { ApiDisputeReason, ApiDisputeStatus } from "@/lib/api/admin";

export const disputeStatusBadge: Record<ApiDisputeStatus, { label: string; className: string }> = {
  OPEN: {
    label: "Ouvert",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  UNDER_REVIEW: {
    label: "En cours d'examen",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  WON: {
    label: "Réclamation rejetée",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  LOST: {
    label: "Réclamation acceptée",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  CLOSED: {
    label: "Clos sans suite",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
};

export const disputeReasonLabels: Record<ApiDisputeReason, string> = {
  FRAUDULENT: "Paiement frauduleux",
  DUPLICATE: "Paiement en double",
  PRODUCT_NOT_RECEIVED: "Billet non reçu",
  PRODUCT_UNACCEPTABLE: "Prestation contestée",
  SUBSCRIPTION_CANCELED: "Annulation",
  GENERAL: "Réclamation",
};

export const disputeStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "OPEN", label: "Ouverts" },
  { id: "UNDER_REVIEW", label: "En cours" },
  { id: "WON", label: "Rejetés" },
  { id: "LOST", label: "Acceptés" },
  { id: "CLOSED", label: "Clos" },
];

/** Motifs proposés à l'acheteur qui signale un problème sur sa commande. */
export const buyerDisputeReasons: Array<{ id: ApiDisputeReason; label: string }> = [
  { id: "PRODUCT_NOT_RECEIVED", label: "Je n'ai pas reçu mes billets" },
  { id: "PRODUCT_UNACCEPTABLE", label: "L'événement ne correspond pas à ce qui était annoncé" },
  { id: "DUPLICATE", label: "J'ai été débité deux fois" },
  { id: "FRAUDULENT", label: "Je ne suis pas à l'origine de cet achat" },
  { id: "GENERAL", label: "Autre problème" },
];

/** Statut brut d'un billet (ticket-service), vu par l'admin. */
export const rawTicketStatusBadge: Record<string, { label: string; className: string }> = {
  GENERATED: { label: "Valide", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  SENT: { label: "Valide", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  FOR_RESALE: { label: "En revente", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  USED: { label: "Utilisé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  CANCELLED: { label: "Annulé", className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20" },
  REFUNDED: { label: "Remboursé", className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20" },
};
