"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import type { FeaturedEvent } from "@/lib/mappers/event-mappers";

// Délai entre deux défilements automatiques (réglage d'interface, pas un
// paramètre métier).
const AUTOPLAY_DELAY_MS = 5000;

/**
 * Carrousel « À la une » : défile tout seul de la droite vers la gauche,
 * une carte à la fois, et reboucle au début après la dernière. Pause au
 * survol / au focus clavier / onglet masqué, et aucun défilement auto si
 * l'utilisateur a demandé à réduire les animations.
 */
export function FeaturedEvents({ events }: { events: FeaturedEvent[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);

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
    if (paused || events.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") step(1);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, events.length, step]);

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20" aria-roledescription="carrousel" aria-label="Événements à la une">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-ink-1">À la une</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/catalogue"
            className="mr-1 hidden text-sm font-medium text-link transition-colors hover:text-link-hover sm:inline"
          >
            Voir tout →
          </Link>
          {events.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Événements précédents"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline-4 text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Événements suivants"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition-opacity hover:opacity-90"
              >
                <Chevron direction="right" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-ink-5">Aucun événement publié pour l&apos;instant.</p>
      ) : (
        <ul
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {events.map((event) => (
            <li
              key={event.id}
              className="w-full shrink-0 snap-start md:w-[calc((100%-1.25rem)/2)]"
            >
              <FeaturedEventCard event={event} />
            </li>
          ))}
        </ul>
      )}
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
