"use client";

import Link from "next/link";
import type { ApiAdminEvent } from "@/lib/api/admin";
import { shortDate as dateFormatter } from "@/lib/format/dates";
import { Badge } from "@/components/ui/badge";
import { t, msg } from "@/lib/i18n/translate";
import { numberFormat } from "@/lib/i18n/intl";

// Catégorie et statut tirés du vrai événement (event-service).
const statusBadge: Record<string, { label: string; className: string }> = {
  PUBLISHED: {
    label: msg("● Publié"),
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  PENDING_VALIDATION: {
    label: msg("⏳ En validation"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  DRAFT: {
    label: msg("Brouillon"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  ARCHIVED: {
    label: msg("Archivé"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  CANCELLED: {
    label: msg("✕ Annulé"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  SUSPENDED: {
    label: "⊘ Suspendu",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  POSTPONED: {
    label: msg("↻ Reporté"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  TERMINATED: {
    label: msg("Terminé"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
};

export function AdminEventRow({ event }: { event: ApiAdminEvent }) {
  const badge = statusBadge[event.status] ?? statusBadge.DRAFT;
  const ticketsLabel =
    event.status === "DRAFT" || event.status === "PENDING_VALIDATION"
      ? "—"
      : `${numberFormat().format(event.sold)} / ${numberFormat().format(event.total_quota)}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hairline-1 text-xl">
          {event.category_emoji ?? "🎫"}
        </span>
        <div>
          <p className="text-sm font-bold text-ink-1">{event.title}</p>
          <p className="text-xs text-ink-5">
            {event.organizer_name} · {event.category_label} · {dateFormatter.format(new Date(event.start_date))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-4">{ticketsLabel}</span>
        <Badge tone={badge.className} size="md">{t(badge.label)}</Badge>
        <Link
          href={`/admin/evenements/${event.id}`}
          className="rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >{t("● Détails")}</Link>
      </div>
    </div>
  );
}
