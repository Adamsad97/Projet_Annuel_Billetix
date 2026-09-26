import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import type { EventDetail } from "@/lib/mock/event-details";

/**
 * En-tête de la page événement : catégorie, titre et lieu à gauche,
 * affiche à droite (fond flouté de la même image pour combler les côtés,
 * quel que soit son format).
 */
export function EventHeader({ event }: { event: EventDetail }) {
  return (
    <section className="border-b border-hairline-2 bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/30">
            {event.categoryLabel}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-ink-1 sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-brand">
            <LocationPinIcon size={18} />
            {event.venueName}
          </p>
        </div>

        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-hairline-2 md:max-w-md md:justify-self-end">
          {event.posterUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, fond décoratif flouté */}
              <img
                src={event.posterUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, hors domaines gérés par next/image */}
              <img
                src={event.posterUrl}
                alt={`Affiche : ${event.title}`}
                className="relative h-full w-full object-contain"
              />
            </>
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${event.band}`}>
              <span className="text-7xl opacity-90" aria-hidden="true">
                {event.heroEmoji}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
