import Link from "next/link";
import type { ApiPendingEvent } from "@/lib/api/admin";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function ValidationRow({
  event,
  categoryEmoji,
  categoryLabel,
  onApprove,
  onReject,
  busy,
}: {
  event: ApiPendingEvent;
  categoryEmoji: string;
  categoryLabel: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
}) {
  const metaParts = [
    event.organizer_name ?? "Organisateur inconnu",
    `Soumis le ${dateFormatter.format(new Date(event.validation_requested_at ?? event.created_at))}`,
    categoryLabel,
  ];
  if (event.is_overdue) metaParts.push("⚠️ Délai dépassé");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">
          {categoryEmoji}
        </span>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-white">{event.title}</p>
            {event.is_non_profit ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                Non lucratif
              </span>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">{metaParts.join(" · ")}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onApprove(event.id)}
          disabled={busy}
          className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
        >
          ✓ Valider
        </button>
        <Link
          href={`/admin/validation/${event.id}`}
          className="rounded-lg bg-white/5 px-3.5 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          ● Info
        </Link>
        <button
          type="button"
          onClick={() => onReject(event.id)}
          disabled={busy}
          className="rounded-lg bg-red-500/15 px-3.5 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
        >
          ✕ Rejeter
        </button>
      </div>
    </div>
  );
}
