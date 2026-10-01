"use client";

// Carte d'ajustement manuel des coordonnées, chargée sans SSR (Leaflet touche window).

import dynamic from "next/dynamic";

const LocationPickerInner = dynamic(() => import("./location-picker-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-hairline-2 bg-hairline-1 text-sm text-ink-5">
      Chargement de la carte…
    </div>
  ),
});

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  disabled = false,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-accent/80">Position sur la carte</span>

      <LocationPickerInner
        latitude={latitude}
        longitude={longitude}
        onChange={disabled ? () => {} : onChange}
      />

      <p className="text-xs text-ink-5">
        {latitude !== null && longitude !== null
          ? "Repositionné automatiquement depuis l'adresse choisie — cliquez ou faites glisser le repère pour ajuster précisément."
          : "Le repère se place automatiquement une fois une adresse choisie ci-dessus, ou cliquez directement sur la carte."}
      </p>
    </div>
  );
}
