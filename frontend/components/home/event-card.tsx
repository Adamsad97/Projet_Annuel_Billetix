import Link from "next/link";
import { categoryPillStyles, type MockEvent } from "@/lib/mock/events";

export function EventCard({ event }: { event: MockEvent }) {
  return (
    <Link
      href={`/evenements/${event.id}`}
      className="block overflow-hidden rounded-2xl border border-white/5 bg-[#12101c] transition-transform hover:-translate-y-0.5 hover:border-white/10"
    >
      <div
        className={`relative flex h-44 items-center justify-center bg-gradient-to-br ${event.band}`}
      >
        <span className="text-5xl opacity-90">{event.emoji}</span>

        <div className="absolute left-3 top-3 rounded-lg bg-black/50 px-2.5 py-1.5 text-center leading-none backdrop-blur">
          <div className="text-base font-bold text-white">{event.day}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-300">
            {event.month}
          </div>
        </div>

        {event.badge ? (
          <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {event.badge}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-bold leading-snug text-white">{event.title}</h3>
          {event.subtitle ? (
            <p className="text-sm text-violet-300">{event.subtitle}</p>
          ) : null}
          <p className="mt-0.5 text-sm text-gray-400">📍 {event.city}</p>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <span
            className={
              event.free
                ? "font-semibold text-emerald-400"
                : "font-semibold text-white"
            }
          >
            {event.priceLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryPillStyles[event.category]}`}
          >
            {event.category}
          </span>
        </div>
      </div>
    </Link>
  );
}
