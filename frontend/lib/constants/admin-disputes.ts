// Libellés et filtres des litiges (payment-service).

import type { ApiDisputeReason, ApiDisputeStatus } from "@/lib/api/admin";
import { msg } from "@/lib/i18n/translate";

export const disputeStatusBadge: Record<ApiDisputeStatus, { label: string; className: string }> = {
  OPEN: {
    label: msg("Ouvert"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  UNDER_REVIEW: {
    label: msg("En cours d'examen"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  WON: {
    label: msg("Réclamation rejetée"),
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  LOST: {
    label: msg("Réclamation acceptée"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  CLOSED: {
    label: msg("Clos sans suite"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
};

export const disputeReasonLabels: Record<ApiDisputeReason, string> = {
  FRAUDULENT: msg("Paiement frauduleux"),
  DUPLICATE: msg("Paiement en double"),
  PRODUCT_NOT_RECEIVED: msg("Billet non reçu"),
  PRODUCT_UNACCEPTABLE: msg("Prestation contestée"),
  SUBSCRIPTION_CANCELED: msg("Annulation"),
  GENERAL: msg("Réclamation"),
};

export const disputeStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: msg("Tous") },
  { id: "OPEN", label: msg("Ouverts") },
  { id: "UNDER_REVIEW", label: msg("En cours") },
  { id: "WON", label: msg("Rejetés") },
  { id: "LOST", label: msg("Acceptés") },
  { id: "CLOSED", label: msg("Clos") },
];

/** Motifs proposés à l'acheteur qui signale un problème sur sa commande. */
export const buyerDisputeReasons: Array<{ id: ApiDisputeReason; label: string }> = [
  { id: "PRODUCT_NOT_RECEIVED", label: msg("Je n'ai pas reçu mes billets") },
  { id: "PRODUCT_UNACCEPTABLE", label: msg("L'événement ne correspond pas à ce qui était annoncé") },
  { id: "DUPLICATE", label: msg("J'ai été débité deux fois") },
  { id: "FRAUDULENT", label: msg("Je ne suis pas à l'origine de cet achat") },
  { id: "GENERAL", label: msg("Autre problème") },
];

/** Statut brut d'un billet (ticket-service), vu par l'admin. */
export const rawTicketStatusBadge: Record<string, { label: string; className: string }> = {
  GENERATED: { label: msg("Valide"), className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  SENT: { label: msg("Valide"), className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  FOR_RESALE: { label: msg("En revente"), className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  USED: { label: msg("Utilisé"), className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  CANCELLED: { label: msg("Annulé"), className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20" },
  REFUNDED: { label: msg("Remboursé"), className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20" },
};
