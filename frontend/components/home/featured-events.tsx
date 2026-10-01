"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EventFilterBar } from "@/components/catalogue/event-filter-bar";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { filtersToUrl } from "@/lib/catalogue/filters";
import { useEventSearch } from "@/lib/catalogue/use-event-search";
import type { FeaturedEvent } from "@/lib/mappers/event-mappers";
import { t } from "@/lib/i18n/translate";

// Sélection de l'admin (stable : ne relance pas la recherche à chaque rendu).
const CURATED_PARAMS = { featured: true } as const;

// Délai entre deux défilements automatiques (réglage d'interface, pas un
// paramètre métier).
const AUTOPLAY_DELAY_MS = 5000;

/** Carrousel auto (pause au survol, au focus, onglet masqué ou animations réduites), qui reboucle. */
export function FeaturedEvents({
  events: initialEvents,
  curated = false,
}: {
  events: FeaturedEvent[];
  /** Sélection faite par l'admin : montrée tant qu'aucun filtre n'est actif. */
  curated?: boolean;
}) {
  // Mêmes filtres que le catalogue, appliqués directement au carrousel. Sans
  // filtre : la sélection « À la une » de l'admin ; avec : tous les événements.
  const search = useEventSearch({ initialEvents, unfilteredParams: curated ? CURATED_PARAMS : undefined });
  const { events, loading, hasActiveFilters, resetAll } = search;
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  // Carrousel actif seulement si des cartes dépassent de l'écran (plus de 3
  // sur grand écran, 2 sur tablette, 1 sur mobile) : sinon, côte à côte.
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setOverflowing(track.scrollWidth > track.clientWidth + 1);
    // Nouveaux résultats (filtre changé) : retour à la première carte.
    track.scrollTo({ left: 0 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [events]);

  const step = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("li");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = (card?.offsetWidth ?? track.clientWidth) + gap;
    const maxScroll = track.scrollWidth - track.clientWidth;

    if (direction === 1 && track.scrollLeft >= maxScroll - 4) {
      track.scrollTo({ left: 0, behavior: "smooth" }); // reboucle au début
    } else if (direction === -1 && track.scrollLeft <= 4) {
      track.scrollTo({ left: maxScroll, behavior: "smooth" }); // reboucle à la fin
    } else {
      track.scrollBy({ left: direction * distance, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (paused || !overflowing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") step(1);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, overflowing, step]);

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20" aria-roledescription="carrousel" aria-label={t("Événements à la une")}>
      <div className="mb-8">
        <EventFilterBar search={search} />
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-ink-1">{hasActiveFilters ? t("Résultats") : t("À la une")}</h2>
        <div className="flex items-center gap-3">
          {overflowing ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t("Événements précédents")}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline-4 text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t("Événements suivants")}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition-opacity hover:opacity-90"
              >
                <Chevron direction="right" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-ink-5">
            {loading
              ? t("Recherche en cours…")
              : hasActiveFilters
                ? t("Aucun événement ne correspond à vos critères.")
                : t("Aucun événement publié pour l'instant.")}
          </p>
          {!loading && hasActiveFilters ? (
            <button type="button" onClick={resetAll} className="text-sm font-medium text-link hover:text-link-hover">{t("Effacer les filtres")}</button>
          ) : null}
        </div>
      ) : (
        <ul
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-busy={loading}
          className={`-mx-3 -mt-3 flex snap-x snap-mandatory scroll-px-3 gap-5 overflow-x-auto scroll-smooth px-3 pb-6 pt-3 transition-opacity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${loading ? "opacity-50" : ""}`}
        >
          {events.map((event) => (
            <li
              key={event.id}
              // 1 carte sur mobile, 2 sur tablette, 3 sur grand écran (gap-5 = 1,25rem).
              className="w-full shrink-0 snap-start md:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              <FeaturedEventCard event={event} />
            </li>
          ))}
        </ul>
      )}

      {/* Tous les événements, avec les filtres choisis ci-dessus. */}
      <div className="mt-8 flex justify-center sm:justify-end">
        <Link
          href={`/evenements${filtersToUrl(search.filters)}`}
          className="rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand/30 transition-opacity hover:opacity-90"
        >{t("Voir les événements")}</Link>
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
