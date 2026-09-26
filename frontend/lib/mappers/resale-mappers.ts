import type { ApiResaleStatus } from "@/lib/api/admin";

/** Statut d'une annonce de revente : libellé et style de badge. */
export const resaleStatusBadge: Record<ApiResaleStatus, { label: string; className: string }> = {
  LISTED: { label: "En vente", className: "bg-warning/10 text-warning ring-warning/30" },
  RESERVED: { label: "Paiement en cours", className: "bg-warning/10 text-warning ring-warning/30" },
  SOLD: { label: "Vendu", className: "bg-success/10 text-success ring-success/30" },
  WITHDRAWN: { label: "Retiré par le vendeur", className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
  EXPIRED: { label: "Expiré (invendu)", className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
};
