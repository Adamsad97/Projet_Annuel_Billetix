// Client du contrôle d'accès (api-gateway, /tickets/scan, /tickets/sync-offline,
// /tickets/event/:id/offline-pack, /tickets/agent/events).

import { apiGet, apiPost } from "./client";
import type { ApiEvent } from "./events";

export type ScanResultCode =
  | "SUCCESS"
  | "ALREADY_USED"
  | "INVALID"
  | "CANCELLED"
  | "WRONG_EVENT"
  | "SUPERSEDED"
  | "EXPIRED"
  | "STATIC_REFUSED"
  | "EVENT_UNAVAILABLE"
  | "TOO_EARLY"
  | "TOO_LATE";

export interface ApiScanResponse {
  result: ScanResultCode;
  ticket_id: string;
  /** Présent seulement quand l'entrée est validée. */
  ticket?: {
    id: string;
    holder_first_name: string;
    holder_last_name: string;
    ticket_category_name: string;
    reference: string;
  };
}

/** Paquet hors ligne : de quoi vérifier un QR signé sans réseau. */
export interface OfflinePack {
  algorithm: "Ed25519";
  /** Clé publique brute (32 octets, base64url). */
  public_key: string;
  rotation_seconds: number;
  tolerance_steps: number;
  generated_at: string;
  tickets: Array<{ id: string; fingerprint: string; status: string }>;
  event: {
    id: string;
    status: string;
    is_hidden: boolean;
    start_date: string;
    end_date: string | null;
    timezone: string | null;
  };
  scan_opens_before_minutes: number;
  scan_closes_after_minutes: number;
}

export interface OfflineScanEntry {
  qr_token: string;
  ticket_id?: string;
  scanned_at_offline: string;
  device_info?: string;
}

export function scanTicket(eventId: string, qrToken: string, deviceInfo?: string): Promise<ApiScanResponse> {
  return apiPost<ApiScanResponse>("/tickets/scan", { event_id: eventId, qr_token: qrToken, device_info: deviceInfo });
}

export function getOfflinePack(eventId: string): Promise<OfflinePack> {
  return apiGet<OfflinePack>(`/tickets/event/${eventId}/offline-pack`);
}

export function syncOfflineScans(
  eventId: string,
  entries: OfflineScanEntry[],
): Promise<{ synced: number; conflicts: number; errors: number }> {
  return apiPost("/tickets/sync-offline", { event_id: eventId, entries });
}

/** Événements auxquels l'agent connecté est affecté. */
export function getAgentEvents(): Promise<ApiEvent[]> {
  return apiGet<ApiEvent[]>("/tickets/agent/events");
}
