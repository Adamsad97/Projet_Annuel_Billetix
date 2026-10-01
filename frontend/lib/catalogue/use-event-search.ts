"use client";

// Recherche d'événements partagée par le catalogue et « À la une » : filtres, requête GET /events, « Afficher plus ».

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCategoryCounts, listCategories, type ApiCategory } from "@/lib/api/categories";
import { countEventsByPeriod, getEventCategories, listPublishedEvents, type ListEventsParams } from "@/lib/api/events";
import { ApiError } from "@/lib/api/http-error";
import {
  DEFAULT_FILTERS,
  BEYOND_MAX_RADIUS,
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  filtersFromUrl,
  filtersToUrl,
  presetPeriods,
  toApiParams,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";
import { requestUserPosition } from "@/lib/geo/user-position";
import { apiEventToFeatured, type FeaturedEvent } from "@/lib/mappers/event-mappers";
import { t } from "@/lib/i18n/translate";

export interface EventSearchOptions {
  /** Filtres lus dans l'adresse et recopiés dedans (lien partageable). */
  syncUrl?: boolean;
  /** Événements déjà rendus par le serveur : pas de rechargement tant qu'aucun filtre n'est touché. */
  initialEvents?: FeaturedEvent[];
  /** Paramètres ajoutés tant qu'aucun filtre n'est actif (ex. sélection « À la une »). */
  unfilteredParams?: ListEventsParams;
}

export function useEventSearch({ syncUrl = false, initialEvents, unfilteredParams }: EventSearchOptions = {}) {
  const [filters, setFilters] = useState<CatalogueFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(!syncUrl);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  // Événements à venir par catégorie ; null tant que non chargé (pas de badge).
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);
  // Événements par période du filtre Date (« today », « weekend »…).
  const [periodCounts, setPeriodCounts] = useState<Record<string, number> | null>(null);

  const [events, setEvents] = useState<FeaturedEvent[]>(initialEvents ?? []);
  const [total, setTotal] = useState(initialEvents?.length ?? 0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!initialEvents);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const requestId = useRef(0);
  // Premier passage avec des événements fournis par le serveur : déjà à jour.
  const skipInitialFetch = useRef(Boolean(initialEvents));

  useEffect(() => {
    if (syncUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- filtres lus dans l'URL côté client
      setFilters(filtersFromUrl(window.location.search));
      setReady(true);
    }
    listCategories()
      .then((list) => setCategories([...list].sort((a, b) => a.display_order - b.display_order)))
      .catch(() => undefined);
  }, [syncUrl]);

  // URL toujours à jour : lien partageable et retour arrière cohérent.
  useEffect(() => {
    if (!ready || !syncUrl) return;
    window.history.replaceState(null, "", `${window.location.pathname}${filtersToUrl(filters)}`);
  }, [filters, ready, syncUrl]);

  const hasActiveFilters =
    filters.q.trim() !== "" ||
    filters.city.trim() !== "" ||
    filters.category !== "" ||
    filters.when !== "all" ||
    filters.price !== "all" ||
    nearMe !== null;

  const apiParams = useMemo(
    () => ({
      ...(hasActiveFilters ? {} : unfilteredParams),
      ...toApiParams(filters),
      ...(nearMe
        ? {
            lat: nearMe.lat,
            lng: nearMe.lng,
            ...(radiusKm === BEYOND_MAX_RADIUS ? { min_distance_km: MAX_RADIUS_KM } : { radius_km: radiusKm }),
          }
        : {}),
    }),
    [filters, nearMe, radiusKm, hasActiveFilters, unfilteredParams],
  );

  const fetchPage = useCallback(
    async (pageNumber: number) => {
      const [{ data, total: count }, referential] = await Promise.all([
        listPublishedEvents({ ...apiParams, page: pageNumber }),
        listCategories().catch(() => []),
      ]);
      const cards = await Promise.all(
        data.map(async (event) => apiEventToFeatured(event, await getEventCategories(event.id).catch(() => []), referential)),
      );
      return { cards, count };
    },
    [apiParams],
  );

  useEffect(() => {
    if (!ready) return;
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
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
        setError(err instanceof ApiError ? err.message : t("Impossible de charger les événements pour le moment."));
        setEvents([]);
        setTotal(0);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [fetchPage, ready]);

  // Nombres des filtres recalculés après une pause de frappe ; une réponse périmée est ignorée.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Le tri ne change pas les nombres : retiré de la requête.
    const countFilters = { ...apiParams, sort: undefined };
    const timeout = setTimeout(() => {
      getCategoryCounts(countFilters)
        .then((counts) => {
          if (!cancelled) setCategoryCounts(counts);
        })
        .catch(() => undefined);
      countEventsByPeriod(presetPeriods(), countFilters)
        .then((counts) => {
          if (!cancelled) setPeriodCounts(counts);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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
      setError(err instanceof ApiError ? err.message : t("Impossible de charger la suite des événements."));
    } finally {
      setLoadingMore(false);
    }
  }

  function update(patch: Partial<CatalogueFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  // Position partagée avec tout le site : les cartes affichent aussi la distance.
  function locate() {
    setLocateError(null);
    setLocating(true);
    requestUserPosition()
      .then(setNearMe)
      .catch((err: Error) => setLocateError(err.message))
      .finally(() => setLocating(false));
  }

  function resetAll() {
    setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
    setNearMe(null);
  }

  return {
    filters,
    update,
    categories,
    categoryCounts,
    periodCounts,
    events,
    total,
    loading,
    loadingMore,
    error,
    hasMore: events.length < total,
    loadMore,
    nearMe,
    disableNearMe: () => setNearMe(null),
    radiusKm,
    setRadiusKm,
    locating,
    locateError,
    locate,
    hasActiveFilters,
    resetAll,
  };
}

export type EventSearch = ReturnType<typeof useEventSearch>;
