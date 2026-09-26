import Link from "next/link";
import { categoryPillStyles, type MockEvent } from "@/lib/mock/events";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";

export function EventCard({ event }: { event: MockEvent }) {
  return (
    <Link
      href={`/evenements/${event.id}`}
      className="block overflow-hidden rounded-2xl border border-hairline-1 bg-card transition-transform hover:-translate-y-0.5 hover:border-hairline-2"
    >
      <div
        className={`relative flex h-44 items-center justify-center ${event.band}`}
      >
        <span className="text-5xl opacity-90">{event.emoji}</span>

        {/* Bug corrigé : badges sur fond fixe (dégradé de catégorie +
            pastille bg-black/50), jamais liés au thème — leur texte
            épinglé en blanc plutôt que sur les tokens ink-* (sombres en
            mode clair, donc invisibles ici). */}
        <div className="absolute left-3 top-3 rounded-lg bg-black/50 px-2.5 py-1.5 text-center leading-none backdrop-blur">
          <div className="text-base font-bold text-white">{event.day}</div>
          <div className="text-[10px] uppercase tracking-wide text-white/80">
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
          <h3 className="font-bold leading-snug text-ink-1">{event.title}</h3>
          {event.subtitle ? (
            <p className="text-sm text-accent">{event.subtitle}</p>
          ) : null}
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-4">
            <LocationPinIcon size={14} />
            {event.city}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-hairline-1 pt-3">
          <span
            className={
              event.free
                ? "font-semibold text-emerald-400"
                : "font-semibold text-ink-1"
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
