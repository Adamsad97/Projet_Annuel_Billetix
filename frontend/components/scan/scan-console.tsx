"use client";

// Console de contrôle d'accès : choix de l'événement, paquet hors ligne,
// caméra, verdict en grand. En ligne, le serveur juge chaque scan ; sans
// réseau, l'appareil vérifie lui-même la signature du QR avec le paquet
// hors ligne, puis synchronise dès le retour du réseau (le serveur revérifie).

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraScanner } from "@/components/scan/camera-scanner";
import { getOrganizerDashboard } from "@/lib/api/organizer";
import {
  getAgentEvents,
  getOfflinePack,
  scanTicket,
  syncOfflineScans,
  type OfflinePack,
  type ScanResultCode,
} from "@/lib/api/scan";
import { ApiError } from "@/lib/api/http-error";
import { getStoredUser } from "@/lib/auth/session";
import { verifyOffline } from "@/lib/scan/offline-verify";
import { clearQueue, enqueue, loadPack, loadQueue, markUsedInPack, savePack } from "@/lib/scan/offline-store";

const SELECTED_EVENT_KEY = "billetix_scan_event";
// Même QR relu par la caméra pendant l'affichage du verdict : ignoré.
const SAME_CODE_IGNORE_MS = 4000;
const VERDICT_DISPLAY_MS = 2200;

type Tone = "success" | "warning" | "danger";

const VERDICTS: Record<ScanResultCode, { label: string; hint: string; tone: Tone }> = {
  SUCCESS: { label: "Entrée validée", hint: "Le billet est valide.", tone: "success" },
  ALREADY_USED: { label: "Billet déjà utilisé", hint: "Ce billet a déjà servi à entrer.", tone: "danger" },
  INVALID: { label: "QR code invalide", hint: "Code inconnu ou falsifié.", tone: "danger" },
  CANCELLED: { label: "Billet annulé", hint: "Billet annulé ou remboursé.", tone: "danger" },
  WRONG_EVENT: { label: "Autre événement", hint: "Ce billet est valable pour un autre événement.", tone: "warning" },
  SUPERSEDED: { label: "Billet revendu ou transféré", hint: "Ce QR appartient à l'ancien titulaire.", tone: "warning" },
  EXPIRED: { label: "QR expiré", hint: "Demandez d'afficher le billet en direct dans l'application.", tone: "warning" },
  STATIC_REFUSED: { label: "Capture ou PDF refusé", hint: "Seul le QR affiché en direct dans l'application est accepté.", tone: "warning" },
  EVENT_UNAVAILABLE: { label: "Événement fermé", hint: "Événement annulé, suspendu ou non publié.", tone: "danger" },
  TOO_EARLY: { label: "Contrôle pas encore ouvert", hint: "Trop tôt avant le début de l'événement.", tone: "warning" },
  TOO_LATE: { label: "Contrôle terminé", hint: "L'événement est terminé.", tone: "warning" },
};

const TONE_STYLES: Record<Tone, string> = {
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-slate-950",
  danger: "bg-red-600 text-white",
};

interface ScanEvent {
  id: string;
  title: string;
  start_date: string;
  venue: string;
}

interface Verdict {
  code: ScanResultCode | "ERROR";
  label: string;
  hint: string;
  tone: Tone;
  offline: boolean;
  holder?: string;
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const timeOnly = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function readSelectedEvent(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_EVENT_KEY);
  } catch {
    return null;
  }
}

function storeSelectedEvent(id: string): void {
  try {
    window.localStorage.setItem(SELECTED_EVENT_KEY, id);
  } catch {
    // Stockage indisponible.
  }
}

export function ScanConsole() {
  const [events, setEvents] = useState<ScanEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [paused, setPaused] = useState(false);
  const [validated, setValidated] = useState(0);
  const [pending, setPending] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const lastCode = useRef<{ text: string; at: number } | null>(null);
  const syncing = useRef(false);

  // --- Événements à contrôler (organisateur : les siens ; agent : ses affectations)
  useEffect(() => {
    const role = getStoredUser()?.role;
    const load: Promise<ScanEvent[]> =
      role === "AGENT"
        ? getAgentEvents().then((list) =>
            list.map((e) => ({ id: e.id, title: e.title, start_date: e.start_date, venue: `${e.venue_name}, ${e.venue_city}` })),
          )
        : getOrganizerDashboard().then((dashboard) =>
            dashboard.events
              .filter((e) => ["PUBLISHED", "SUSPENDED", "TERMINATED"].includes(e.status))
              .map((e) => ({ id: e.id, title: e.title, start_date: e.start_date, venue: `${e.venue_name}, ${e.venue_city}` })),
          );
    load
      .then((list) => {
        const sorted = [...list].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        setEvents(sorted);
        const remembered = readSelectedEvent();
        if (remembered && sorted.some((e) => e.id === remembered)) setEventId(remembered);
      })
      .catch((err) => setEventsError(err instanceof ApiError ? err.message : "Impossible de charger vos événements."));
  }, []);

  // --- Connexion réseau
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const refreshPack = useCallback(async (id: string) => {
    setPackLoading(true);
    setPackError(null);
    try {
      const fresh = await getOfflinePack(id);
      savePack(fresh);
      setPack(fresh);
    } catch (err) {
      setPackError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : "Pas de réseau : paquet hors ligne non mis à jour.",
      );
    } finally {
      setPackLoading(false);
    }
  }, []);

  const syncQueue = useCallback(
    async (id: string) => {
      const queue = loadQueue(id);
      if (queue.length === 0 || syncing.current) return;
      syncing.current = true;
      try {
        const result = await syncOfflineScans(id, queue);
        clearQueue(id);
        setPending(0);
        setSyncMessage(
          `${queue.length} scan${queue.length > 1 ? "s" : ""} hors ligne synchronisé${queue.length > 1 ? "s" : ""} : ` +
            `${result.synced} validé${result.synced > 1 ? "s" : ""}` +
            (result.conflicts ? `, ${result.conflicts} déjà utilisé${result.conflicts > 1 ? "s" : ""}` : "") +
            (result.errors ? `, ${result.errors} refusé${result.errors > 1 ? "s" : ""}` : "") +
            ".",
        );
        await refreshPack(id);
      } catch {
        // Réseau encore instable : nouvel essai au prochain retour en ligne.
      } finally {
        syncing.current = false;
      }
    },
    [refreshPack],
  );

  // --- Changement d'événement : paquet local puis mise à jour, file d'attente
  useEffect(() => {
    if (!eventId) return;
    storeSelectedEvent(eventId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- paquet local lu après le montage
    setPack(loadPack(eventId));
    setPending(loadQueue(eventId).length);
    setValidated(0);
    setVerdict(null);
    setSyncMessage(null);
    void refreshPack(eventId);
    void syncQueue(eventId);
  }, [eventId, refreshPack, syncQueue]);

  // --- Retour du réseau : synchronisation automatique
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'état n'est modifié qu'après l'appel réseau
    if (online && eventId) void syncQueue(eventId);
  }, [online, eventId, syncQueue]);

  function show(next: Verdict) {
    setVerdict(next);
    if (typeof navigator.vibrate === "function") navigator.vibrate(next.tone === "success" ? 120 : [90, 60, 90]);
    setTimeout(() => setPaused(false), VERDICT_DISPLAY_MS);
  }

  async function judgeOffline(text: string, id: string) {
    const current = loadPack(id);
    if (!current) {
      show({ code: "ERROR", label: "Pas de réseau", hint: "Aucun paquet hors ligne : reconnectez-vous pour le télécharger.", tone: "danger", offline: true });
      return;
    }
    const now = new Date();
    const verdictOffline = await verifyOffline(text, current, now);
    if (verdictOffline.result === null) {
      show({ code: "ERROR", label: "Vérification impossible", hint: "Ce navigateur ne sait pas vérifier les QR hors ligne : utilisez un navigateur récent.", tone: "danger", offline: true });
      return;
    }
    if (verdictOffline.result === "SUCCESS" && verdictOffline.ticketId) {
      setPending(enqueue(id, { qr_token: text, ticket_id: verdictOffline.ticketId, scanned_at_offline: now.toISOString(), device_info: navigator.userAgent.slice(0, 300) }).length);
      setPack(markUsedInPack(id, verdictOffline.ticketId));
      setValidated((n) => n + 1);
    }
    show({ ...VERDICTS[verdictOffline.result], code: verdictOffline.result, offline: true });
  }

  async function handleCode(text: string) {
    if (!eventId || paused) return;
    const now = Date.now();
    if (lastCode.current && lastCode.current.text === text && now - lastCode.current.at < SAME_CODE_IGNORE_MS) return;
    lastCode.current = { text, at: now };
    setPaused(true);

    if (!navigator.onLine) {
      await judgeOffline(text, eventId);
      return;
    }
    try {
      const response = await scanTicket(eventId, text, navigator.userAgent.slice(0, 300));
      if (response.result === "SUCCESS" || response.result === "ALREADY_USED") {
        const updated = markUsedInPack(eventId, response.ticket_id);
        if (updated) setPack(updated);
      }
      if (response.result === "SUCCESS") setValidated((n) => n + 1);
      show({
        ...VERDICTS[response.result],
        code: response.result,
        offline: false,
        holder: response.ticket ? `${response.ticket.holder_first_name} ${response.ticket.holder_last_name} — ${response.ticket.ticket_category_name}` : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        show({ code: "ERROR", label: "Scan refusé", hint: err.message, tone: "danger", offline: false });
      } else {
        // Réseau perdu pendant l'envoi : décision locale avec le paquet.
        await judgeOffline(text, eventId);
      }
    }
  }

  const selected = events?.find((e) => e.id === eventId) ?? null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-link">Contrôle d&apos;accès</p>
          <h1 className="text-xl font-bold text-ink-1">Scan des billets</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            online ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/20 text-amber-600"
          }`}
        >
          {online ? "● En ligne" : "● Hors ligne"}
        </span>
      </div>

      {/* Événement */}
      <section className="rounded-2xl border border-hairline-1 bg-card p-4">
        {eventsError ? (
          <p className="text-sm text-danger">{eventsError}</p>
        ) : events === null ? (
          <p className="text-sm text-ink-5">Chargement de vos événements…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-5">Aucun événement à contrôler pour le moment.</p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">Événement contrôlé</span>
            <select
              value={eventId ?? ""}
              onChange={(e) => setEventId(e.target.value || null)}
              className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 focus:border-blue-500 focus:outline-none"
            >
              <option value="" className="bg-card">Choisir un événement…</option>
              {events.map((e) => (
                <option key={e.id} value={e.id} className="bg-card">
                  {e.title} — {dateTime.format(new Date(e.start_date))}
                </option>
              ))}
            </select>
          </label>
        )}

        {selected ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-5">
            <span>
              {pack
                ? `Paquet hors ligne : ${pack.tickets.length} billet${pack.tickets.length > 1 ? "s" : ""}, mis à jour à ${timeOnly.format(new Date(pack.generated_at))}`
                : "Paquet hors ligne non téléchargé"}
            </span>
            <button
              type="button"
              disabled={packLoading || !online}
              onClick={() => eventId && refreshPack(eventId)}
              className="font-medium text-link hover:text-link-hover disabled:opacity-50"
            >
              {packLoading ? "Mise à jour…" : "Mettre à jour"}
            </button>
            {packError ? <p className="w-full text-amber-600">{packError}</p> : null}
          </div>
        ) : null}
      </section>

      {selected ? (
        <>
          {cameraOn ? (
            <CameraScanner onCode={(text) => void handleCode(text)} paused={paused} />
          ) : (
            <button
              type="button"
              onClick={() => setCameraOn(true)}
              className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline-3 bg-card text-ink-3 transition-colors hover:border-hairline-5"
            >
              <span className="text-5xl" aria-hidden="true">📷</span>
              <span className="text-sm font-semibold">Démarrer le scan</span>
            </button>
          )}

          {/* Verdict */}
          <div
            role="status"
            aria-live="assertive"
            className={`rounded-2xl px-5 py-5 text-center transition-colors ${
              verdict ? TONE_STYLES[verdict.tone] : "border border-hairline-1 bg-card text-ink-4"
            }`}
          >
            {verdict ? (
              <>
                <p className="text-2xl font-extrabold">{verdict.label}</p>
                {verdict.holder ? <p className="mt-1 text-base font-semibold">{verdict.holder}</p> : null}
                <p className="mt-1 text-sm opacity-90">{verdict.hint}</p>
                {verdict.offline ? <p className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-80">Vérifié hors ligne</p> : null}
              </>
            ) : (
              <p className="text-sm">Présentez le QR code du billet devant la caméra.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-hairline-1 bg-card p-4 text-center">
              <p className="text-2xl font-bold text-ink-1">{validated}</p>
              <p className="text-xs text-ink-5">Entrée{validated > 1 ? "s" : ""} validée{validated > 1 ? "s" : ""} (cette session)</p>
            </div>
            <div className="rounded-2xl border border-hairline-1 bg-card p-4 text-center">
              <p className="text-2xl font-bold text-ink-1">{pending}</p>
              <p className="text-xs text-ink-5">En attente de synchronisation</p>
              {pending > 0 && online ? (
                <button type="button" onClick={() => eventId && syncQueue(eventId)} className="mt-1 text-xs font-medium text-link hover:text-link-hover">
                  Synchroniser
                </button>
              ) : null}
            </div>
          </div>

          {syncMessage ? <p className="text-center text-xs text-ink-4">{syncMessage}</p> : null}

          {cameraOn ? (
            <button
              type="button"
              onClick={() => setCameraOn(false)}
              className="rounded-full border border-hairline-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Arrêter la caméra
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
