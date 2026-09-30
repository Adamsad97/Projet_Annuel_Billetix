import Link from "next/link";
import { categoryPillStyles, type MockEvent } from "@/lib/constants/events";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { eventPath } from "@/lib/format/event-path";
import { cardClass } from "@/components/ui/card";

export function EventCard({ event }: { event: MockEvent }) {
  return (
    <Link
      href={eventPath(event)}
      className={cardClass("group block overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-hairline-2 hover:shadow-xl")}
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          event.posterUrl ? "aspect-[4/5] bg-slate-950" : `h-44 ${event.band}`
        }`}
      >
        {event.posterUrl ? (
          <>
            {/* Affiche entière (jamais recadrée : elle porte souvent du
                texte), sur un fond tiré d'elle-même, flouté. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- fond décoratif, affiche hébergée sur MinIO */}
            <img
              src={event.posterUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, hors domaines gérés par next/image */}
            <img
              src={event.posterUrl}
              alt={`Affiche : ${event.title}`}
              loading="lazy"
              className="relative h-full w-full object-contain p-2.5 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          </>
        ) : (
          <span className="text-5xl opacity-90">{event.emoji}</span>
        )}

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

        {event.suspendedNotice !== undefined && event.suspendedNotice !== null ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-ink-2">
            <span className="font-semibold">Ventes momentanément suspendues.</span>
            {event.suspendedNotice ? <span className="mt-0.5 block line-clamp-2 text-ink-3">{event.suspendedNotice}</span> : null}
          </p>
        ) : null}

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
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryPillStyles[event.category] ?? categoryPillStyles.Autre}`}
          >
            {event.categoryLabel ?? event.category}
          </span>
        </div>
      </div>
    </Link>
  );
}
