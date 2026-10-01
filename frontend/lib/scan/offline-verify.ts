// Vérification d'un QR signé sans réseau, mêmes règles que le serveur, qui revérifie à la synchronisation.

import type { OfflinePack, ScanResultCode } from "@/lib/api/scan";

const OPEN_EVENT_STATUSES = ["PUBLISHED", "TERMINATED"];
const PAYLOAD_LENGTH = 47;

export type OfflineVerdict =
  | { result: ScanResultCode; ticketId?: string }
  // Navigateur sans Ed25519 (WebCrypto) : vérification hors ligne impossible.
  | { result: null; reason: "unsupported" };

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function uuid(bytes: Uint8Array): string {
  return hex(bytes).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function publicKey(raw: string): Promise<CryptoKey> {
  let key = keyCache.get(raw);
  if (!key) {
    key = crypto.subtle.importKey("raw", fromBase64Url(raw), { name: "Ed25519" }, false, ["verify"]);
    keyCache.set(raw, key);
  }
  return key;
}

export async function verifyOffline(raw: string, pack: OfflinePack, at: Date = new Date()): Promise<OfflineVerdict> {
  const match = /^BTX3\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(raw.trim());
  if (!match) {
    // Ancien QR éphémère (BTX2) ou QR fixe : jamais acceptés.
    return { result: raw.startsWith("BTX2.") ? "EXPIRED" : "INVALID" };
  }
  const payload = fromBase64Url(match[1]);
  const signature = fromBase64Url(match[2]);
  if (payload.length !== PAYLOAD_LENGTH || signature.length !== 64 || payload[0] !== 1) return { result: "INVALID" };

  let authentic: boolean;
  try {
    authentic = await crypto.subtle.verify({ name: "Ed25519" }, await publicKey(pack.public_key), signature, payload);
  } catch {
    return { result: null, reason: "unsupported" };
  }
  if (!authentic) return { result: "INVALID" };

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const ticketId = uuid(payload.subarray(1, 17));
  const eventId = uuid(payload.subarray(17, 33));
  const validFrom = view.getUint32(33) * 1000;
  const periodMs = view.getUint16(37) * 1000;
  const fingerprint = hex(payload.subarray(39, 47));

  if (eventId !== pack.event.id) return { result: "WRONG_EVENT", ticketId };
  const tolerance = pack.tolerance_steps * periodMs;
  if (at.getTime() < validFrom - tolerance || at.getTime() >= validFrom + periodMs + tolerance) {
    return { result: "EXPIRED", ticketId };
  }

  const ticket = pack.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { result: "INVALID", ticketId };
  if (ticket.fingerprint !== fingerprint) return { result: "SUPERSEDED", ticketId };
  if (ticket.status === "USED") return { result: "ALREADY_USED", ticketId };
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") return { result: "CANCELLED", ticketId };
  if (ticket.status === "FOR_RESALE") return { result: "FOR_RESALE", ticketId };

  if (pack.event.is_hidden || !OPEN_EVENT_STATUSES.includes(pack.event.status)) {
    return { result: "EVENT_UNAVAILABLE", ticketId };
  }
  const start = new Date(pack.event.start_date).getTime();
  const end = new Date(pack.event.end_date ?? pack.event.start_date).getTime();
  if (at.getTime() < start - pack.scan_opens_before_minutes * 60_000) return { result: "TOO_EARLY", ticketId };
  if (at.getTime() > end + pack.scan_closes_after_minutes * 60_000) return { result: "TOO_LATE", ticketId };

  return { result: "SUCCESS", ticketId };
}
