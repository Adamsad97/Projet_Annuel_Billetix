import Link from "next/link";
import { disputeStatusBadge, type AdminDispute } from "@/lib/mock/admin-disputes";

export function DisputeRow({ dispute }: { dispute: AdminDispute }) {
  const badge = disputeStatusBadge[dispute.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-ink-1">
            {dispute.orderRef} · {dispute.event}
          </p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-5">
          {dispute.buyer} · {dispute.reason} · {dispute.openedLabel}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-bold text-ink-1">{dispute.amountLabel}</span>
        <Link
          href={`/admin/litiges/${dispute.id}`}
          className="rounded-lg bg-hairline-1 px-3.5 py-2 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >
          ● Traiter
        </Link>
      </div>
    </div>
  );
}
