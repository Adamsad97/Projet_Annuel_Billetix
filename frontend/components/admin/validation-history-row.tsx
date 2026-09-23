import Link from "next/link";
import type { ValidationHistoryEntry } from "@/lib/mappers/admin-mappers";

export function ValidationHistoryRow({
  entry,
  outcome,
}: {
  entry: ValidationHistoryEntry;
  outcome: "approved" | "rejected";
}) {
  const content = (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${entry.iconBg}`}
        >
          {entry.emoji}
        </span>
        <div>
          <p className="text-sm font-bold text-white">{entry.title}</p>
          <p className="text-xs text-gray-500">
            Par {entry.performedBy} · {entry.decidedLabel}
            {entry.reason ? ` · ${entry.reason}` : ""}
          </p>
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
          {outcome === "approved" ? "✓ Validé" : "✕ Rejeté"}
        </span>
        {entry.eventId ? <span className="text-sm text-violet-400">● Info</span> : null}
      </div>
    </div>
  );

  if (!entry.eventId) return content;

  return (
    <Link href={`/admin/validation/${entry.eventId}`} className="block transition-colors hover:bg-white/[0.02]">
      {content}
    </Link>
  );
}
