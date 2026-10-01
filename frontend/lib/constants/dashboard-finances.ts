// Styles des badges de statut de reversement — les données réelles viennent
// de getMyPayouts()/getMyBalance() (lib/api/organizer.ts).

import type { ApiPayoutStatus } from "@/lib/api/organizer";
import { msg } from "@/lib/i18n/translate";

export const payoutStatusBadge: Record<ApiPayoutStatus, { label: string; className: string }> = {
  PENDING: {
    label: msg("⏳ En attente"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  PROCESSING: {
    label: msg("🔄 En cours"),
    className: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  },
  TO_TRANSFER: {
    label: msg("🏦 Virement en préparation"),
    className: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  },
  COMPLETED: {
    label: msg("✓ Versé"),
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  BLOCKED: {
    label: msg("⛔ Bloqué"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  FAILED: {
    label: msg("✗ Échoué"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
};
