import type { Attendee } from "@/lib/mappers/event-detail-mappers";

const STATUS_STYLE: Record<Attendee["status"], { label: string; className: string }> = {
  used: { label: "✓ Entré", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  pending: { label: "En attente", className: "bg-hairline-1 text-ink-4 ring-hairline-2" },
  cancelled: { label: "Annulé", className: "bg-red-500/15 text-red-300 ring-red-500/30" },
};

export function AttendeeRow({ attendee }: { attendee: Attendee }) {
  const style = STATUS_STYLE[attendee.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-3.5 last:border-b-0">
      <div>
        <p className="text-sm font-bold text-ink-1">{attendee.name}</p>
        <p className="text-xs text-ink-5">
          {attendee.email} · {attendee.category} · acheté le {attendee.purchasedLabel}
        </p>
      </div>

      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.className}`}>
        {style.label}
      </span>
    </div>
  );
}
