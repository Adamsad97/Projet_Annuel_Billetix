"use client";

// Bug corrigé : venue_latitude/venue_longitude existaient déjà côté backend
// (colonnes, DTO, filtre de distance Haversine dans event-service) mais
// n'étaient alimentées par aucun formulaire — impossible d'afficher le lieu
// sur une carte ou de filtrer "près de moi" faute de coordonnées en base.
//
// Le géocodage se fait maintenant en amont, via AddressAutocomplete
// (composant dédié, suggestions au fil de la frappe) — ce composant reste
// volontairement une simple carte de positionnement/ajustement manuel
// (clic ou glisser le repère), sans bouton de recherche qui ferait doublon.
//
// Chargement dynamique sans SSR : react-leaflet/leaflet accèdent à `window`
// dès l'import, ce qui casse le rendu serveur de la page si ce module est
// importé directement dans un arbre rendu côté serveur.

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
