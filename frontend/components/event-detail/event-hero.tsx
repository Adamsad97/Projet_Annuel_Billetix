import type { EventDetail } from "@/lib/mock/event-details";

export function EventHero({ event }: { event: EventDetail }) {
  return (
    <section
      className={`relative overflow-hidden bg-gradient-to-br ${event.band} px-6 py-12`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 select-none text-[12rem] leading-none opacity-10"
      >
        {event.heroEmoji}
      </span>

      <div className="relative mx-auto max-w-7xl">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
          {event.categoryEmoji} {event.categoryLabel}
        </span>

        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          {event.title}
          <br />
          {event.venueName}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-300">
          <span className="inline-flex items-center gap-1.5">
            📅 {event.dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            📍 {event.city}
          </span>
          <span className="inline-flex items-center gap-1.5">
            👥 {event.remainingLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            ✓ {event.statusLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
