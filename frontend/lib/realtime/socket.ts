"use client";

// Connexion temps réel unique (realtime-service), authentifiée par le jeton d'accès et partagée par toutes les pages.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { refreshAccessToken } from "@/lib/api/client";
import { getAccessToken, SESSION_ENDED_EVENT } from "@/lib/auth/session";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3010";

export interface TicketScannedMessage {
  ticket_id: string;
  event_name: string;
  ticket_category_name: string;
  scanned_at: string;
}

export interface DashboardChangedMessage {
  event_id: string;
  reason: "sale" | "scan";
}

export interface AdminAlertMessage {
  type: "mass_refunds" | "dispute_spike" | "duplicate_scan";
  severity: "warning" | "critical";
  data: { count?: number; threshold?: number; ticket_id?: string; event_id?: string };
}

let socket: Socket | null = null;
let connected = false;
const statusListeners = new Set<() => void>();

function setConnected(value: boolean) {
  connected = value;
  statusListeners.forEach((listener) => listener());
}

/** Ouvre la connexion si une session existe (sans effet sinon, ou si elle est déjà ouverte). */
export function connectRealtime(): Socket | null {
  if (typeof window === "undefined" || !getAccessToken()) return null;
  if (socket) return socket;

  socket = io(REALTIME_URL, {
    // Relu à chaque (re)connexion : le jeton renouvelé est toujours utilisé.
    auth: (cb) => cb({ token: getAccessToken() ?? "" }),
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 10_000,
  });
  socket.on("connect", () => setConnected(true));
  socket.on("disconnect", async (reason) => {
    setConnected(false);
    // Coupure par le serveur (jeton expiré) : nouveau jeton, puis reconnexion.
    if (reason === "io server disconnect") {
      const token = await refreshAccessToken().catch(() => null);
      if (token) socket?.connect();
      else closeRealtime();
    }
  });
  window.addEventListener(SESSION_ENDED_EVENT, closeRealtime);
  return socket;
}

export function closeRealtime(): void {
  window.removeEventListener(SESSION_ENDED_EVENT, closeRealtime);
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  setConnected(false);
}

/** Connexion temps réel active (indicateur « En direct »). */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => connected,
    () => false,
  );
}

/** Écoute un message du serveur tant que le composant est affiché. */
export function useRealtimeEvent<T>(event: string, handler: (message: T) => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const current = connectRealtime();
    if (!current) return;
    const listener = (message: T) => handlerRef.current(message);
    current.on(event, listener);
    return () => {
      current.off(event, listener);
    };
  }, [event, enabled]);
}

/** Abonnement au tableau de bord d'un événement (renouvelé après chaque reconnexion). */
export function useDashboardSubscription(eventId: string | null): void {
  useEffect(() => {
    if (!eventId) return;
    const current = connectRealtime();
    if (!current) return;
    const subscribe = () => current.emit("dashboard:subscribe", { event_id: eventId });
    if (current.connected) subscribe();
    current.on("connect", subscribe);
    return () => {
      current.off("connect", subscribe);
      current.emit("dashboard:unsubscribe", { event_id: eventId });
    };
  }, [eventId]);
}
