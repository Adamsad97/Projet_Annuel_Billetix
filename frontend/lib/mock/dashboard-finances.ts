// Styles des badges de statut de reversement — les données réelles viennent
// de getMyPayouts()/getMyBalance() (lib/api/organizer.ts).

import type { ApiPayoutStatus } from "@/lib/api/organizer";

export const payoutStatusBadge: Record<ApiPayoutStatus, { label: string; className: string }> = {
  PENDING: {
    label: "⏳ En attente",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  PROCESSING: {
    label: "🔄 En cours",
    className: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  },
  COMPLETED: {
    label: "✓ Versé",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  BLOCKED: {
    label: "⛔ Bloqué",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  FAILED: {
    label: "✗ Échoué",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
};
