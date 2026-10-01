"use client";

import Link from "next/link";
import type { ValidationHistoryEntry } from "@/lib/mappers/admin-mappers";
import { t } from "@/lib/i18n/translate";

export function ValidationHistoryRow({
  entry,
  outcome,
}: {
  entry: ValidationHistoryEntry;
  outcome: "approved" | "rejected";
}) {
  const content = (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${entry.iconBg}`}
        >
          {entry.emoji}
        </span>
        <div>
          <p className="text-sm font-bold text-ink-1">{entry.title}</p>
          <p className="text-xs text-ink-5">{t("Par {performedBy} · {decidedLabel}{value}", { performedBy: entry.performedBy, decidedLabel: entry.decidedLabel, value: entry.reason ? ` · ${entry.reason}` : "" })}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          className={
            outcome === "approved"
              ? "rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
              : "rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30"
          }
        >
          {outcome === "approved" ? t("✓ Validé") : t("✕ Rejeté")}
        </span>
        {entry.eventId ? <span className="text-sm text-link">{t("● Info")}</span> : null}
      </div>
    </div>
  );

  if (!entry.eventId) return content;

  return (
    <Link href={`/admin/validation/${entry.eventId}`} className="block transition-colors hover:bg-hairline-1">
      {content}
    </Link>
  );
}
