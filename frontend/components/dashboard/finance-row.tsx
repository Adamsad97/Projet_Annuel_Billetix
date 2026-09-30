import { payoutStatusBadge } from "@/lib/constants/dashboard-finances";
import type { ApiPayout } from "@/lib/api/organizer";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateFormatter } from "@/lib/format/dates";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function FinanceRow({
  payout,
  onRequestEarly,
  busy,
}: {
  payout: ApiPayout;
  onRequestEarly: (id: string) => void;
  busy: boolean;
}) {
  const badge = payoutStatusBadge[payout.status];
  const canRequestEarly = payout.status === "PENDING" && !payout.requested_early_at;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-ink-1">{payout.event_title ?? "Événement"}</p>
          <Badge tone={badge.className}>
            {badge.label}
          </Badge>
          {payout.requested_early_at ? (
            <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-blue-500/30">
              Anticipé demandé
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-ink-5">
          Prévu le {dateFormatter.format(new Date(payout.scheduled_at))}
          {payout.processed_at ? ` · versé le ${dateFormatter.format(new Date(payout.processed_at))}` : ""}
        </p>
        {payout.status === "BLOCKED" && payout.blocked_reason ? (
          <p className="mt-1 text-xs text-red-400">{payout.blocked_reason}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-6 text-right text-sm">
        <div>
          <p className="text-xs text-ink-5">Brut</p>
          <p className="font-medium text-ink-3">{currency.format(payout.gross_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-5">Commission</p>
          <p className="font-medium text-amber-400">{currency.format(payout.commission_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-5">Net</p>
          <p className="font-bold text-ink-1">{currency.format(payout.net_amount)}</p>
        </div>
        {canRequestEarly ? (
          <button
            type="button"
            onClick={() => onRequestEarly(payout.id)}
            disabled={busy}
            className={buttonClass("secondary", "rounded-full px-3 py-1.5 text-xs disabled:opacity-50")}
          >
            Demander un versement anticipé
          </button>
        ) : null}
      </div>
    </div>
  );
}
