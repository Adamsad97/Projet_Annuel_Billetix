"use client";

// Catalogue public : recherche, filtres (catégorie, date, prix, distance),
// tri et pagination « Afficher plus ». Les filtres sont appliqués par le
// serveur (GET /events) et reflétés dans l'URL, donc partageables.

import { useEffect, useMemo, useRef, useState } from "react";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { ApiError } from "@/lib/api/http-error";
import {
  DEFAULT_FILTERS,
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  SORT_OPTIONS,
  WHEN_OPTIONS,
  filtersFromUrl,
  filtersToUrl,
  priceLabel,
  toApiParams,
  whenLabel,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";
import { apiEventToFeatured, type FeaturedEvent } from "@/lib/mappers/event-mappers";
import { cardClass } from "@/components/ui/card";
import { filterSelectClass } from "@/components/ui/field";
import { LoadMoreButton } from "@/components/ui/load-more-button";

const fieldClassName =
  "h-11 w-full rounded-full border border-hairline-3 bg-card pl-11 pr-4 text-sm text-ink-1 placeholder:text-ink-5 focus:border-blue-500 focus:outline-none";
const smallInputClassName =
  "h-10 w-full rounded-xl border border-hairline-3 bg-page px-3 text-sm text-ink-1 focus:border-blue-500 focus:outline-none";
const applyButtonClassName =
  "h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CatalogueExplorer() {
  const [filters, setFilters] = useState<CatalogueFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Saisies des menus Date et Prix : appliquées au clic sur « Appliquer ».
  const [draftDates, setDraftDates] = useState({ from: "", to: "" });
  const [draftPrice, setDraftPrice] = useState({ min: "", max: "" });

  const requestId = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filtres lus dans l'URL côté client
    setFilters(filtersFromUrl(window.location.search));
    setReady(true);
    listCategories()
      .then((list) => setCategories([...list].sort((a, b) => a.display_order - b.display_order)))
      .catch(() => undefined);
  }, []);

  // URL toujours à jour : lien partageable et retour arrière cohérent.
  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(null, "", `${window.location.pathname}${filtersToUrl(filters)}`);
  }, [filters, ready]);

  const apiParams = useMemo(
    () => ({
      ...toApiParams(filters),
      ...(nearMe ? { lat: nearMe.lat, lng: nearMe.lng, radius_km: radiusKm } : {}),
    }),
    [filters, nearMe, radiusKm],
  );

  async function fetchPage(pageNumber: number) {
    const { data, total: count } = await listPublishedEvents({ ...apiParams, page: pageNumber });
    const cards = await Promise.all(
      data.map(async (event) => apiEventToFeatured(event, await getEventCategories(event.id).catch(() => []))),
    );
    return { cards, count };
  }

  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;
    // Attend une pause de frappe avant d'interroger le serveur.
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { cards, count } = await fetchPage(1);
        if (id !== requestId.current) return;
        setEvents(cards);
        setTotal(count);
        setPage(1);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof ApiError ? err.message : "Impossible de charger le catalogue pour le moment.");
        setEvents([]);
        setTotal(0);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage dépend d'apiParams
  }, [apiParams, ready]);

  async function loadMore() {
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const { cards } = await fetchPage(page + 1);
      if (id !== requestId.current) return;
      setEvents((current) => [...current, ...cards]);
      setPage((current) => current + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la suite du catalogue.");
    } finally {
      setLoadingMore(false);
    }
  }

  function update(patch: Partial<CatalogueFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateError("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }
    setLocateError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearMe({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocateError("Position refusée ou indisponible : autorisez la géolocalisation dans votre navigateur.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const categoryLabel = categories.find((c) => c.code === filters.category)?.label ?? filters.category;

  const hasActiveFilters =
    filters.q.trim() !== "" ||
    filters.city.trim() !== "" ||
    filters.category !== "" ||
    filters.when !== "all" ||
    filters.price !== "all" ||
    nearMe !== null;

  function resetAll() {
    setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
    setNearMe(null);
  }

  const hasMore = events.length < total;

  return (
    <div className="flex flex-col gap-6">
      {/* Recherche */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px]">
        <label className="relative">
          <span className="sr-only">Rechercher</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-5">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Événement, artiste, lieu…"
            className={fieldClassName}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Ville</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-5">
            <LocationPinIcon />
          </span>
          <input
            type="text"
            value={filters.city}
            onChange={(event) => update({ city: event.target.value })}
            placeholder="Ville"
            className={fieldClassName}
          />
        </label>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu label="Catégorie" value={categoryLabel} active={filters.category !== ""}>
            {(close) => (
              <div role="menu">
                <FilterOption selected={filters.category === ""} onSelect={() => { update({ category: "" }); close(); }}>
                  Toutes les catégories
                </FilterOption>
                {categories.map((category) => (
                  <FilterOption
                    key={category.id}
                    selected={filters.category === category.code}
                    onSelect={() => { update({ category: category.code }); close(); }}
                  >
                    {category.emoji ? `${category.emoji} ` : ""}
                    {category.label}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>

          <FilterMenu label="Date" value={whenLabel(filters)} active={filters.when !== "all"}>
            {(close) => (
              <div role="menu">
                {WHEN_OPTIONS.filter((option) => option.id !== "custom").map((option) => (
                  <FilterOption
                    key={option.id}
                    selected={filters.when === option.id}
                    onSelect={() => { update({ when: option.id, from: "", to: "" }); close(); }}
                  >
                    {option.label}
                  </FilterOption>
                ))}
                <div className="mt-2 border-t border-hairline-1 px-2 pb-1 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-5">Choisir des dates</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-ink-5">
                      Du
                      <input
                        type="date"
                        value={draftDates.from}
                        onChange={(event) => setDraftDates((d) => ({ ...d, from: event.target.value }))}
                        className={smallInputClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-5">
                      Au
                      <input
                        type="date"
                        value={draftDates.to}
                        min={draftDates.from || undefined}
                        onChange={(event) => setDraftDates((d) => ({ ...d, to: event.target.value }))}
                        className={smallInputClassName}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!draftDates.from && !draftDates.to}
                    onClick={() => { update({ when: "custom", from: draftDates.from, to: draftDates.to }); close(); }}
                    className={`${applyButtonClassName} mt-3`}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}
          </FilterMenu>

          <FilterMenu label="Prix" value={priceLabel(filters)} active={filters.price !== "all"}>
            {(close) => (
              <div role="menu">
                <FilterOption selected={filters.price === "all"} onSelect={() => { update({ price: "all", minPrice: "", maxPrice: "" }); close(); }}>
                  Tous les prix
                </FilterOption>
                <FilterOption selected={filters.price === "free"} onSelect={() => { update({ price: "free", minPrice: "", maxPrice: "" }); close(); }}>
                  Gratuit
                </FilterOption>
                <div className="mt-2 border-t border-hairline-1 px-2 pb-1 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-5">Fourchette de prix (TTC)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-ink-5">
                      Minimum (€)
                      <input
                        inputMode="decimal"
                        value={draftPrice.min}
                        onChange={(event) => setDraftPrice((p) => ({ ...p, min: event.target.value }))}
                        placeholder="0"
                        className={smallInputClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-5">
                      Maximum (€)
                      <input
                        inputMode="decimal"
                        value={draftPrice.max}
                        onChange={(event) => setDraftPrice((p) => ({ ...p, max: event.target.value }))}
                        placeholder="100"
                        className={smallInputClassName}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!draftPrice.min.trim() && !draftPrice.max.trim()}
                    onClick={() => { update({ price: "custom", minPrice: draftPrice.min, maxPrice: draftPrice.max }); close(); }}
                    className={`${applyButtonClassName} mt-3`}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}
          </FilterMenu>

          <FilterMenu label="Distance" value={`À moins de ${radiusKm} km`} active={nearMe !== null}>
            {(close) => (
              <div className="flex flex-col gap-3 p-2">
                <p className="text-sm text-ink-3">Événements autour de votre position actuelle.</p>
                <label className="flex flex-col gap-1 text-xs text-ink-5">
                  Rayon
                  <select
                    value={radiusKm}
                    onChange={(event) => setRadiusKm(Number(event.target.value))}
                    className={smallInputClassName}
                  >
                    {RADIUS_OPTIONS_KM.map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </select>
                </label>
                {locateError ? <p className="text-xs text-danger">{locateError}</p> : null}
                <div className="flex gap-2">
                  {nearMe ? (
                    <button
                      type="button"
                      onClick={() => { setNearMe(null); close(); }}
                      className="h-10 flex-1 rounded-xl border border-hairline-3 text-sm font-medium text-ink-2 hover:text-ink-1"
                    >
                      Désactiver
                    </button>
                  ) : null}
                  <button type="button" onClick={locate} disabled={locating} className={`${applyButtonClassName} flex-1`}>
                    {locating ? "Localisation…" : nearMe ? "Actualiser ma position" : "Utiliser ma position"}
                  </button>
                </div>
              </div>
            )}
          </FilterMenu>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetAll}
              className="h-10 px-2 text-sm font-medium text-link transition-colors hover:text-link-hover"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-5">
          Trier par
          <select
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as CatalogueFilters["sort"] })}
            className={filterSelectClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-danger">{error}</p>
      ) : null}

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cardClass("h-96 animate-pulse")} />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-5" role="status">
            {total} événement{total > 1 ? "s" : ""}
          </p>

          {events.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <FeaturedEventCard
                  key={event.id}
                  event={{
                    ...event,
                    // Libellé du référentiel admin (chargé en parallèle des événements).
                    categoryLabel: categories.find((c) => c.code === event.categoryCode)?.label ?? event.categoryLabel,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className={cardClass("flex flex-col items-center gap-3 px-5 py-12 text-center")}>
              <p className="text-sm font-medium text-ink-2">
                {hasActiveFilters ? "Aucun événement ne correspond à vos critères." : "Aucun événement à venir pour le moment."}
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={resetAll} className="text-sm font-medium text-link hover:text-link-hover">
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          )}

          {hasMore ? (
            <LoadMoreButton onClick={loadMore} loading={loadingMore} label="Afficher plus d'événements" />
          ) : null}
        </>
      )}
    </div>
  );
}
