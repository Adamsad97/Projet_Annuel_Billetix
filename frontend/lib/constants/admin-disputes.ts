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
    label: "Gagné",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  LOST: {
    label: "Perdu",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  CLOSED: {
    label: "Clos",
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
  { id: "WON", label: "Gagnés" },
  { id: "LOST", label: "Perdus" },
  { id: "CLOSED", label: "Clos" },
];
