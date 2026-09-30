import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { PosterViewer } from "@/components/event-detail/poster-viewer";
import { EventStartCountdown } from "@/components/event-detail/event-start-countdown";
import type { EventDetail } from "@/lib/constants/event-details";

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Libellé du prix d'appel : « Entrée gratuite », « 25,00 € », ou rien. */
export function fromPriceLabel(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  return price === 0 ? "Entrée gratuite" : priceFormatter.format(price);
}

/**
 * En-tête immersif de la page événement : l'affiche, floutée, habille tout
 * le fond ; au premier plan l'affiche elle-même (proportions d'origine,
 * agrandissable), le titre, la date, le lieu et l'accès à la billetterie.
 * Toujours sombre, quel que soit le thème, pour mettre l'affiche en valeur.
 */
export function EventHeader({ event, purchasable }: { event: EventDetail; purchasable: boolean }) {
  const price = fromPriceLabel(event.fromPrice);
  const soldOut = purchasable && event.tickets.length > 0 && event.tickets.every((t) => t.remaining === 0);

  return (
    <section className="relative isolate overflow-hidden bg-slate-950 text-white">
      {/* Fond : l'affiche floutée et assombrie, ou un dégradé à défaut. */}
      {event.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- fond décoratif, affiche hébergée sur MinIO
        <img
          src={event.posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full scale-125 object-cover opacity-70 blur-3xl saturate-150"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-brand/40 via-slate-900 to-slate-950" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(2,6,23,0.35),rgba(2,6,23,0.85)_60%,rgba(2,6,23,0.97))]"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-[minmax(0,360px)_1fr] md:gap-14 md:py-16 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="mx-auto flex w-full max-w-[340px] justify-center md:max-w-none">
          {event.posterUrl ? (
            <PosterViewer src={event.posterUrl} title={event.title} />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-white/5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/15">
              <span className="text-8xl" aria-hidden="true">
                {event.heroEmoji}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur">
              {event.categoryLabel}
            </span>
            {soldOut ? (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-200 ring-1 ring-inset ring-red-400/40">
                Complet
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {event.title}
          </h1>

          <dl className="mt-8 flex flex-col gap-5">
            {event.calendar ? (
              <div className="flex items-center gap-4">
                {/* Pavé calendrier : jour de la semaine, quantième, mois. */}
                <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center text-slate-900 shadow-lg">
                  <span className="bg-brand py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    {event.calendar.month.replace(".", "")}
                  </span>
                  <span className="pt-1 text-2xl font-extrabold leading-none">{event.calendar.day}</span>
                  <span className="pb-1.5 text-[11px] font-medium uppercase text-slate-500">
                    {event.calendar.weekday.replace(".", "")}
                  </span>
                </div>
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd className="text-lg font-semibold first-letter:uppercase">{event.longDateLabel}</dd>
                  <dd className="text-sm text-white/70">
                    {event.dateRangeLabel && event.dateRangeLabel.includes("→") ? `${event.dateRangeLabel}, ` : ""}
                    {event.timeRangeLabel}
                  </dd>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand ring-1 ring-inset ring-white/15">
                <LocationPinIcon size={26} />
              </div>
              <div className="min-w-0">
                <dt className="sr-only">Lieu</dt>
                <dd className="text-lg font-semibold">{event.venueName}</dd>
                <dd className="truncate text-sm text-white/70">{event.address}</dd>
              </div>
            </div>
          </dl>

          {purchasable && event.startAt ? (
            <EventStartCountdown salesStartIso={event.salesStartAt} startIso={event.startAt} />
          ) : null}

          {purchasable && !soldOut && event.tickets.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/10 pt-8">
              {price ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/60">
                    {event.fromPrice === 0 ? "Tarif" : "À partir de"}
                  </p>
                  <p className="text-3xl font-extrabold tracking-tight">{price}</p>
                </div>
              ) : null}
              <a
                href="#billets"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40"
              >
                Réserver mes billets
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
