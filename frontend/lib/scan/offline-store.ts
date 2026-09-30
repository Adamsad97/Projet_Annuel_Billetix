// Stockage local de l'appareil de contrôle (par événement) : paquet hors
// ligne et scans en attente de synchronisation. Accès protégés : le
// stockage peut être indisponible (navigation privée, stockage bloqué).

import type { OfflinePack, OfflineScanEntry } from "@/lib/api/scan";

const packKey = (eventId: string) => `billetix_scan_pack_${eventId}`;
const queueKey = (eventId: string) => `billetix_scan_queue_${eventId}`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : le contrôle continue, sans mémoire locale.
  }
}

export const loadPack = (eventId: string) => read<OfflinePack>(packKey(eventId));
export const savePack = (pack: OfflinePack) => write(packKey(pack.event.id), pack);

/** Billet consommé : le paquet local le sait aussitôt (anti double entrée hors ligne). */
export function markUsedInPack(eventId: string, ticketId: string): OfflinePack | null {
  const pack = loadPack(eventId);
  if (!pack) return null;
  const updated = { ...pack, tickets: pack.tickets.map((t) => (t.id === ticketId ? { ...t, status: "USED" } : t)) };
  savePack(updated);
  return updated;
}

export const loadQueue = (eventId: string) => read<OfflineScanEntry[]>(queueKey(eventId)) ?? [];

export function enqueue(eventId: string, entry: OfflineScanEntry): OfflineScanEntry[] {
  const queue = [...loadQueue(eventId), entry];
  write(queueKey(eventId), queue);
  return queue;
}

export function clearQueue(eventId: string): void {
  try {
    window.localStorage.removeItem(queueKey(eventId));
  } catch {
    // Stockage indisponible.
  }
}
