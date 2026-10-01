"use client";

// Position du visiteur, partagée par tout le site pour afficher la distance des événements.

import { useEffect, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n/translate";
import { localizedNumber } from "@/lib/i18n/intl";

export interface UserPosition {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "billetix_user_position";

let position: UserPosition | null = null;
let loaded = false;
let silentAttempted = false;
const listeners = new Set<() => void>();

function readStored(): UserPosition | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as UserPosition;
    return Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : null;
  } catch {
    return null;
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  position = readStored();
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  load();
  return position;
}

/** Enregistre la position (onglet courant) et prévient tous les composants abonnés. */
export function setUserPosition(next: UserPosition) {
  position = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : la position reste connue jusqu'au rechargement.
  }
  listeners.forEach((listener) => listener());
}

/** Demande la position au navigateur (affiche l'autorisation si elle n'a jamais été donnée). */
export function requestUserPosition(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error(t("La géolocalisation n'est pas disponible sur ce navigateur.")));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next = { lat: result.coords.latitude, lng: result.coords.longitude };
        setUserPosition(next);
        resolve(next);
      },
      () => reject(new Error(t("Position refusée ou indisponible : autorisez la géolocalisation dans votre navigateur."))),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  });
}

/** Sans jamais afficher de demande : position relue seulement si le visiteur l'a déjà autorisée. */
async function refreshIfAlreadyGranted() {
  if (silentAttempted || position) return;
  silentAttempted = true;
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    if (status?.state === "granted") await requestUserPosition();
  } catch {
    // API des permissions absente ou position indisponible : pas de distance.
  }
}

/** Position connue du visiteur, ou null (aucune demande d'autorisation n'est déclenchée ici). */
export function useUserPosition(): UserPosition | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null);
  useEffect(() => {
    void refreshIfAlreadyGranted();
  }, []);
  return current;
}

/** Distance à vol d'oiseau en km (formule de Haversine, comme le filtre côté serveur). */
export function distanceKm(from: UserPosition, to: UserPosition): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const kmFormat = localizedNumber({ maximumFractionDigits: 1 });
const roundKm = localizedNumber({ maximumFractionDigits: 0 });

/** « À 800 m », « À 3,4 km », « À 125 km ». */
export function formatDistance(km: number): string {
  if (km < 1) return t("À {value} m", { value: Math.max(100, Math.round(km * 10) * 100) });
  if (km < 10) return t("À {value} km", { value: kmFormat.format(km) });
  return t("À {value} km", { value: roundKm.format(km) });
}
