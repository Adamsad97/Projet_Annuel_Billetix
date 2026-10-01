"use client";

import { useState } from "react";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { distanceKm, formatDistance, requestUserPosition, useUserPosition } from "@/lib/geo/user-position";

interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

/** Pastille « À 12 km » d'une carte d'événement, seulement si la position du visiteur est connue. */
export function EventDistanceChip({ latitude, longitude }: Coordinates) {
  const position = useUserPosition();
  if (!position || latitude === null || longitude === null) return null;
  return (
    <li
      title="Distance à vol d'oiseau depuis votre position"
      className="inline-flex items-center gap-2 rounded-full border border-hairline-3 px-3 py-1.5 text-sm text-ink-3"
    >
      <span className="flex shrink-0 text-ink-4">
        <LocationPinIcon size={16} />
      </span>
      {formatDistance(distanceKm(position, { lat: latitude, lng: longitude }))}
    </li>
  );
}

/** Distance de l'événement dans l'en-tête de sa page, avec un bouton pour partager sa position. */
export function EventDistanceLine({ latitude, longitude }: Coordinates) {
  const position = useUserPosition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (latitude === null || longitude === null) return null;

  if (position) {
    return (
      <dd className="text-sm text-white/70" title="Distance à vol d'oiseau depuis votre position">
        {formatDistance(distanceKm(position, { lat: latitude, lng: longitude }))} de vous
      </dd>
    );
  }

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      await requestUserPosition();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position indisponible.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <dd className="text-sm">
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="font-medium text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white disabled:opacity-60"
      >
        {locating ? "Localisation…" : "Afficher la distance depuis ma position"}
      </button>
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </dd>
  );
}
