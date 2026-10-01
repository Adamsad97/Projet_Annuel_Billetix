"use client";

// Recherche d'événements partagée par le catalogue et « À la une » :
// filtres (recherche, ville, catégorie, date, prix, distance, tri),
// interrogation du serveur (GET /events) et pagination « Afficher plus ».

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCategoryCounts, listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { ApiError } from "@/lib/api/http-error";
import {
  DEFAULT_FILTERS,
  DEFAULT_RADIUS_KM,
  filtersFromUrl,
  filtersToUrl,
  toApiParams,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";
import { apiEventToFeatured, type FeaturedEvent } from "@/lib/mappers/event-mappers";

export interface EventSearchOptions {
  /** Filtres lus dans l'adresse et recopiés dedans (lien partageable). */
  syncUrl?: boolean;
  /** Événements déjà rendus par le serveur : pas de rechargement tant qu'aucun filtre n'est touché. */
  initialEvents?: FeaturedEvent[];
}

export function useEventSearch({ syncUrl = false, initialEvents }: EventSearchOptions = {}) {
  const [filters, setFilters] = useState<CatalogueFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(!syncUrl);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  // Événements à venir par catégorie ; null tant que non chargé (pas de badge).
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);

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
    getCategoryCounts()
      .then(setCategoryCounts)
      .catch(() => undefined);
  }, [syncUrl]);

  // URL toujours à jour : lien partageable et retour arrière cohérent.
  useEffect(() => {
    if (!ready || !syncUrl) return;
    window.history.replaceState(null, "", `${window.location.pathname}${filtersToUrl(filters)}`);
  }, [filters, ready, syncUrl]);

  const apiParams = useMemo(
    () => ({
      ...toApiParams(filters),
      ...(nearMe ? { lat: nearMe.lat, lng: nearMe.lng, radius_km: radiusKm } : {}),
    }),
    [filters, nearMe, radiusKm],
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
        setError(err instanceof ApiError ? err.message : "Impossible de charger les événements pour le moment.");
        setEvents([]);
        setTotal(0);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [fetchPage, ready]);

  async function loadMore() {
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const { cards } = await fetchPage(page + 1);
      if (id !== requestId.current) return;
      setEvents((current) => [...current, ...cards]);
      setPage((current) => current + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la suite des événements.");
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

  return {
    filters,
    update,
    categories,
    categoryCounts,
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
