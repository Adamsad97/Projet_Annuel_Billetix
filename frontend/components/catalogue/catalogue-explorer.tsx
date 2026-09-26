"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/home/event-card";
import { SearchInput } from "@/components/admin/search-input";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { apiEventToCard } from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";
import type { MockEvent } from "@/lib/mock/events";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";

const categories: { id: string; label: string; emoji?: string; apiCode?: string }[] = [
  { id: "all", label: "Tous" },
  { id: "Concert", label: "Concert", emoji: "🎵", apiCode: "CONCERT" },
  { id: "Festival", label: "Festival", emoji: "🎪", apiCode: "FESTIVAL" },
  { id: "Théâtre", label: "Théâtre", emoji: "🎭", apiCode: "THEATRE" },
  { id: "Sport", label: "Sport", emoji: "⚽", apiCode: "SPORT" },
  { id: "Conférence", label: "Conférence", emoji: "💡", apiCode: "CONFERENCE" },
  { id: "Danse", label: "Danse", emoji: "💃", apiCode: "DANSE" },
  { id: "gratuit", label: "Gratuit", emoji: "🎫" },
];

// Bug corrigé : event-service exposait déjà un filtre de distance
// (Haversine, params lat/lng/radius_km) jamais branché sur le catalogue —
// aucun moyen de voir "les événements près de moi" malgré le travail déjà
// fait côté backend.
const RADIUS_OPTIONS_KM = [10, 25, 50, 100] as const;
const DEFAULT_RADIUS_KM = 25;

export function CatalogueExplorer() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [events, setEvents] = useState<MockEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  function handleToggleNearMe() {
    if (nearMe) {
      setNearMe(null);
      return;
    }
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
        setLocateError("Position refusée ou indisponible — autorise la géolocalisation pour utiliser ce filtre.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    const selected = categories.find((c) => c.id === category);

    // Attend une pause de frappe avant d'interroger le vrai backend.
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await listPublishedEvents({
          q: search.trim() || undefined,
          category: selected?.apiCode,
          ...(nearMe
            ? { lat: nearMe.lat, lng: nearMe.lng, radius_km: radiusKm }
            : {}),
        });

        const withCategories = await Promise.all(
          data.map(async (event) => {
            const cats = await getEventCategories(event.id).catch(() => []);
            return apiEventToCard(event, cats);
          }),
        );

        if (cancelled) return;

        const filtered =
          category === "gratuit"
            ? withCategories.filter((e) => e.free)
            : withCategories;

        setEvents(filtered);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger le catalogue pour le moment.",
        );
        setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, category, nearMe, radiusKm]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isActive = cat.id === category;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={
                  isActive
                    ? "rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow shadow-blue-900/40"
                    : "rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 hover:text-ink-1"
                }
              >
                {cat.emoji ? <span className="mr-1.5">{cat.emoji}</span> : null}
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleNearMe}
            disabled={locating}
            className={
              nearMe
                ? "rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow shadow-blue-900/40"
                : "rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {locating ? (
              "Localisation…"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <LocationPinIcon />
                {nearMe ? "Près de moi ✕" : "Près de moi"}
              </span>
            )}
          </button>
          {nearMe ? (
            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="rounded-full bg-hairline-1 px-3 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2"
            >
              {RADIUS_OPTIONS_KM.map((km) => (
                <option key={km} value={km} className="bg-card">
                  {km} km
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un événement ou une ville…"
        />
      </div>

      {locateError ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 text-sm text-amber-300">
          {locateError}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-5">Chargement des événements…</p>
      ) : (
        <>
          <p className="text-sm text-ink-5">
            {events?.length ?? 0} événement{(events?.length ?? 0) > 1 ? "s" : ""} trouvé
            {(events?.length ?? 0) > 1 ? "s" : ""}
          </p>

          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-10 text-center text-sm text-ink-5">
              Aucun événement ne correspond à cette recherche.
            </p>
          )}
        </>
      )}
    </div>
  );
}
