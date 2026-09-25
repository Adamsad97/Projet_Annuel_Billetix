"use client";

// Bug corrigé : la fiche événement publique affichait un encart "Carte
// interactive" 100% factice, jamais relié aux coordonnées de l'événement
// (venue_latitude/venue_longitude, stockées côté backend mais jamais
// exploitées côté affichage).

import dynamic from "next/dynamic";

const EventLocationMapInner = dynamic(() => import("./event-location-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-gray-500">
      Chargement de la carte…
    </div>
  ),
});

export function EventLocationMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number | null;
  longitude: number | null;
  label: string;
}) {
  if (latitude === null || longitude === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
        <span className="text-sm text-gray-500">📍 Position non renseignée</span>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    );
  }

  return <EventLocationMapInner latitude={latitude} longitude={longitude} label={label} />;
}
