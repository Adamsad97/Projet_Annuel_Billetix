import Link from "next/link";
import type { ApiPayout, ApiPayoutStatus } from "@/lib/api/admin";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateFormatter } from "@/lib/format/dates";
import { Badge } from "@/components/ui/badge";
import { payoutSettlement } from "@/lib/finance/payout-settlement";

export const payoutStatusBadge: Record<ApiPayoutStatus, { label: string; className: string }> = {
  PENDING: { label: "⏳ En attente", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  PROCESSING: { label: "⏳ Virement en cours", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  COMPLETED: { label: "✓ Versé", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  BLOCKED: { label: "⛔ Bloqué", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  FAILED: { label: "✕ Échoué", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
};

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
  const settlement = payoutSettlement(payout);
  const awaitingEarlyApproval = Boolean(payout.requested_early_at) && !payout.early_request_approved_by;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-ink-1">
            {payout.event_name} — {payout.organizer_name}
          </p>
          <Badge tone={badge.className}>{badge.label}</Badge>
          {payout.on_hold_for_postponement ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
              Événement reporté
            </span>
          ) : null}
          {settlement.badge ? <Badge tone={settlement.badge.className}>{settlement.badge.label}</Badge> : null}
          {awaitingEarlyApproval ? (
            <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-blue-500/30">
              Demande anticipée
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-ink-5">
          {payout.on_hold_for_postponement
            ? "En attente de la nouvelle date de l'événement reporté"
            : `Prévu le ${dateFormatter.format(new Date(payout.scheduled_at))}`}
          {payout.blocked_reason ? ` · ${payout.blocked_reason}` : ""}
        </p>
        {settlement.detail ? <p className="mt-0.5 text-xs text-ink-4">{settlement.detail}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-lg font-bold text-ink-1">{currency.format(payout.net_amount)}</span>

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
          className="rounded-lg bg-hairline-1 px-3.5 py-2 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >
          ● Détails
        </Link>
      </div>
    </div>
  );
}
