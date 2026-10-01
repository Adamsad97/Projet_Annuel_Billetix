import type { ApiResaleStatus } from "@/lib/api/admin";
import { msg } from "@/lib/i18n/translate";

/** Statut d'une annonce de revente : libellé et style de badge. */
export const resaleStatusBadge: Record<ApiResaleStatus, { label: string; className: string }> = {
  LISTED: { label: msg("En vente"), className: "bg-warning/10 text-warning ring-warning/30" },
  RESERVED: { label: msg("Paiement en cours"), className: "bg-warning/10 text-warning ring-warning/30" },
  SOLD: { label: msg("Vendu"), className: "bg-success/10 text-success ring-success/30" },
  WITHDRAWN: { label: msg("Retiré par le vendeur"), className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
  EXPIRED: { label: msg("Expiré (invendu)"), className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
};
