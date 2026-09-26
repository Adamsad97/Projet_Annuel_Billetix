import { payoutStatusBadge } from "@/lib/mock/dashboard-finances";
import type { ApiPayout } from "@/lib/api/organizer";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

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
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
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
            className="rounded-full border border-hairline-3 px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
          >
            Demander un versement anticipé
          </button>
        ) : null}
      </div>
    </div>
  );
}
