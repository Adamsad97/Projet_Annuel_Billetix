import Link from "next/link";
import {
  statusBadgeStyles,
  type OrganizerEvent,
} from "@/lib/mock/dashboard";

export function OrganizerEventRow({ event }: { event: OrganizerEvent }) {
  const badge = statusBadgeStyles[event.status];

  const content = (
    <div className="flex flex-col gap-4 border-b border-hairline-1 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${event.iconBg}`}
        >
          {event.emoji}
        </span>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-ink-1">
              {event.title} — {event.dateLabel}
            </h3>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-4">{event.venue}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-hairline-1">
            <div
              className={`h-full rounded-full ${event.progressColor}`}
              style={{ width: `${event.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-5">{event.progressLabel}</p>
        </div>
      </div>

      <div className="text-right sm:pl-4">
        <p className="text-lg font-bold text-ink-1">{event.amountLabel}</p>
        {event.amountSubLabel ? (
          <p className="text-xs text-ink-5">{event.amountSubLabel}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Link href={`/dashboard/evenements/${event.id}`} className="block transition-colors hover:bg-hairline-1">
      {content}
    </Link>
  );
}
