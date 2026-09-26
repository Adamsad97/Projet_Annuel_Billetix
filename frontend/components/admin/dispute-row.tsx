import type { ApiDispute } from "@/lib/api/admin";
import { disputeReasonLabels, disputeStatusBadge } from "@/lib/constants/admin-disputes";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function DisputeRow({ dispute }: { dispute: ApiDispute }) {
  const badge = disputeStatusBadge[dispute.status];

  return (
    <div className="flex flex-col gap-1 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-ink-1">{disputeReasonLabels[dispute.reason] ?? dispute.reason}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge?.className ?? ""}`}>
          {badge?.label ?? dispute.status}
        </span>
      </div>
      <p className="text-xs text-ink-5">
        Commande {dispute.order_id.slice(0, 8).toUpperCase()} · ouvert le {dateFormatter.format(new Date(dispute.created_at))}
      </p>
      {dispute.description ? <p className="text-sm text-ink-4">{dispute.description}</p> : null}
    </div>
  );
}
