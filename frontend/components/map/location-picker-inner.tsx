"use client";

// Composant interne, chargé uniquement côté client (cf. location-picker.tsx)
// — Leaflet touche `window`/`document` dès l'import du module, ce qui casse
// le rendu serveur si ce fichier est importé directement depuis un composant
// rendu en SSR.

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { Marker as LeafletMarker, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet-icon-fix";
import { FRANCE_CENTER } from "@/lib/geo/france";

const DEFAULT_CENTER = FRANCE_CENTER;
const DEFAULT_ZOOM = 5;
const PIN_ZOOM = 16;

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

// Recentre la carte quand latitude/longitude changent depuis l'extérieur
// (ex : après un géocodage d'adresse) — MapContainer n'observe pas ses
// props `center`/`zoom` après le montage initial.
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
  }, [lat, lng, map]);

  return null;
}

export default function LocationPickerInner({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasPin = latitude !== null && longitude !== null;
  const center: [number, number] = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  return (
    <div className="overflow-hidden rounded-xl border border-hairline-2">
      <MapContainer
        center={center}
        zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: 280, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        {hasPin ? (
          <>
            <Marker
              position={[latitude, longitude]}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as LeafletMarker;
                  const pos = marker.getLatLng();
                  onChange(pos.lat, pos.lng);
                },
              }}
            />
            <Recenter lat={latitude} lng={longitude} />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
