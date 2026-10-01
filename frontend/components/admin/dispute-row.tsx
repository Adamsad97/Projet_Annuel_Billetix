"use client";

import Link from "next/link";
import type { ApiDispute } from "@/lib/api/admin";
import { disputeReasonLabels, disputeStatusBadge } from "@/lib/constants/admin-disputes";
import { dateTime as dateFormatter } from "@/lib/format/dates";
import { euros } from "@/lib/format/money";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/translate";

export function DisputeRow({ dispute }: { dispute: ApiDispute }) {
  const badge = disputeStatusBadge[dispute.status];

  return (
    <Link
      href={`/admin/litiges/${dispute.id}`}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-1 px-5 py-4 transition-colors last:border-b-0 hover:bg-hairline-1/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-ink-1">{t(disputeReasonLabels[dispute.reason] ?? dispute.reason)}</p>
          <Badge tone={badge?.className ?? ""}>{badge?.label ?? dispute.status}</Badge>
          {dispute.stripe_dispute_id ? (
            <Badge tone="bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30">{t("Contestation bancaire")}</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-ink-5">{t("{value} · ouvert le {value2}", { value: [dispute.order_reference ?? t("Commande {id}", { id: dispute.order_id.slice(0, 8).toUpperCase() }), dispute.event_name, dispute.buyer_name]
            .filter(Boolean)
            .join(" · "), value2: dateFormatter.format(new Date(dispute.created_at)) })}</p>
        {dispute.description ? <p className="mt-1 line-clamp-1 text-sm text-ink-4">{t(dispute.description)}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {dispute.amount_ttc != null ? <span className="text-sm font-semibold text-ink-2">{euros.format(dispute.amount_ttc)}</span> : null}
        <span className="text-sm text-link">{t("Ouvrir →")}</span>
      </div>
    </Link>
  );
}
