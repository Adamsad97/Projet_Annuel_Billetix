"use client";

import type { Attendee } from "@/lib/mappers/event-detail-mappers";
import { Badge } from "@/components/ui/badge";
import { t, msg } from "@/lib/i18n/translate";

const STATUS_STYLE: Record<Attendee["status"], { label: string; className: string }> = {
  used: { label: msg("Entré"), className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  pending: { label: msg("À scanner"), className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
  cancelled: { label: msg("Annulé"), className: "bg-red-500/15 text-red-300 ring-red-500/30" },
};

export function AttendeeRow({ attendee }: { attendee: Attendee }) {
  const style = STATUS_STYLE[attendee.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-3.5 last:border-b-0">
      <div>
        <p className="text-sm font-bold text-ink-1">{attendee.name}</p>
        <p className="text-xs text-ink-5">
          {attendee.email} · {attendee.category} · <span className="font-mono">{attendee.reference}</span>{" "}{t("· acheté le")}{" "}
          {attendee.purchasedLabel}
        </p>
      </div>

      <Badge tone={style.className} size="md" className="shrink-0 ring-1 ring-inset">
        {t(style.label)}
      </Badge>
    </div>
  );
}
