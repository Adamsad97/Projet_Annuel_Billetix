import Link from "next/link";
import type { ApiPayout, ApiPayoutStatus } from "@/lib/api/admin";

export const payoutStatusBadge: Record<ApiPayoutStatus, { label: string; className: string }> = {
  PENDING: { label: "⏳ En attente", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  PROCESSING: { label: "⏳ Virement en cours", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  COMPLETED: { label: "✓ Versé", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  BLOCKED: { label: "⛔ Bloqué", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  FAILED: { label: "✕ Échoué", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
};

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function PayoutRow({
  payout,
  busy,
  onBlock,
  onUnblock,
  onApproveEarly,
}: {
  payout: ApiPayout;
  busy: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  onApproveEarly: () => void;
}) {
  const badge = payoutStatusBadge[payout.status];
  const awaitingEarlyApproval = Boolean(payout.requested_early_at) && !payout.early_request_approved_by;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-white">
            {payout.event_name} — {payout.organizer_name}
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          {awaitingEarlyApproval ? (
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
              Demande anticipée
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          Prévu le {dateFormatter.format(new Date(payout.scheduled_at))}
          {payout.blocked_reason ? ` · ${payout.blocked_reason}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-lg font-bold text-white">{currency.format(payout.net_amount)}</span>

        {awaitingEarlyApproval ? (
          <button
            type="button"
            disabled={busy}
            onClick={onApproveEarly}
            className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
          >
            ✓ Approuver l&apos;anticipation
          </button>
        ) : null}

        {payout.status === "BLOCKED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUnblock}
            className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
          >
            Débloquer
          </button>
        ) : payout.status === "PENDING" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onBlock}
            className="rounded-lg bg-red-500/15 px-3.5 py-2 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
          >
            Bloquer
          </button>
        ) : null}

        <Link
          href={`/admin/reversements/${payout.id}`}
          className="rounded-lg bg-white/5 px-3.5 py-2 text-xs font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          ● Détails
        </Link>
      </div>
    </div>
  );
}
