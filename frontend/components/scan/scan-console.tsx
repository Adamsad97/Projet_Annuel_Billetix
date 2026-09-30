"use client";

// Console de contrôle d'accès : choix de l'événement, paquet hors ligne,
// caméra, verdict en grand. En ligne, le serveur juge chaque scan ; sans
// réseau, l'appareil vérifie lui-même la signature du QR avec le paquet
// hors ligne, puis synchronise dès le retour du réseau (le serveur revérifie).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraScanner } from "@/components/scan/camera-scanner";
import { EntryProgress } from "@/components/scan/entry-progress";
import { getEvent } from "@/lib/api/events";
import {
  getAgentEvents,
  getEntryStats,
  getOrganizerScanEvents,
  getOfflinePack,
  scanTicket,
  syncOfflineScans,
  type OfflinePack,
  type ScanResultCode,
} from "@/lib/api/scan";
import { ApiError } from "@/lib/api/http-error";
import { getStoredUser } from "@/lib/auth/session";
import { verifyOffline } from "@/lib/scan/offline-verify";
import { closedEventNotice, scanEventStatus } from "@/lib/scan/event-status";
import { clearQueue, enqueue, loadPack, loadQueue, markUsedInPack, savePack } from "@/lib/scan/offline-store";
import { dateTime, time as timeOnly } from "@/lib/format/dates";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";

const SELECTED_EVENT_KEY = "billetix_scan_event";
// Même QR relu par la caméra pendant l'affichage du verdict : ignoré.
const SAME_CODE_IGNORE_MS = 4000;
const VERDICT_DISPLAY_MS = 2200;
// Nombre de scans gardés dans l'historique affiché.
const HISTORY_SIZE = 30;
// Entrées de l'événement relues pendant que la page est affichée, pour
// suivre aussi les scans des autres agents.
const ENTRY_STATS_REFRESH_MS = 30_000;
// Billets qui ne sont plus attendus à l'entrée.
const NOT_EXPECTED = new Set(["CANCELLED", "REFUNDED"]);

type Tone = "success" | "warning" | "danger";

// Refusé (rouge) : ce QR ne fera jamais entrer cette personne.
// À vérifier (orange) : la personne est peut-être dans son droit, une action
// immédiate règle le problème (billet affiché en direct, revenir à l'ouverture).
const VERDICTS: Record<ScanResultCode, { label: string; hint: string; tone: Tone }> = {
  SUCCESS: { label: "Entrée validée", hint: "Le billet est valide.", tone: "success" },
  ALREADY_USED: { label: "Billet déjà utilisé", hint: "Ce billet a déjà servi à entrer.", tone: "danger" },
  INVALID: { label: "QR code invalide", hint: "Code inconnu ou falsifié.", tone: "danger" },
  CANCELLED: { label: "Billet annulé", hint: "Billet annulé ou remboursé.", tone: "danger" },
  SUPERSEDED: {
    label: "Billet revendu ou offert",
    hint: "Ce QR appartient à l'ancien titulaire : seul le nouveau titulaire peut entrer.",
    tone: "danger",
  },
  FOR_RESALE: {
    label: "Billet mis en revente",
    hint: "Son titulaire l'a mis en vente : entrée impossible tant que l'annonce est active.",
    tone: "danger",
  },
  WRONG_EVENT: { label: "Autre événement", hint: "Ce billet est valable pour un autre événement.", tone: "danger" },
  EVENT_UNAVAILABLE: { label: "Événement fermé", hint: "Événement annulé, suspendu ou non publié.", tone: "danger" },
  TOO_LATE: { label: "Contrôle terminé", hint: "L'événement est terminé : plus d'entrée possible.", tone: "danger" },
  EXPIRED: { label: "QR expiré", hint: "Demandez d'afficher le billet en direct dans l'application.", tone: "warning" },
  STATIC_REFUSED: {
    label: "Capture ou PDF",
    hint: "Demandez d'afficher le billet en direct dans l'application.",
    tone: "warning",
  },
  TOO_EARLY: { label: "Contrôle pas encore ouvert", hint: "Trop tôt : la personne doit revenir à l'ouverture.", tone: "warning" },
};

const TONE_STYLES: Record<Tone, string> = {
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-slate-950",
  danger: "bg-red-600 text-white",
};

/** Icône du verdict, dessinée (les symboles ✓ ✕ ne sont pas dans toutes les polices). */
function VerdictIcon({ tone, className = "" }: { tone: Tone; className?: string }) {
  const path =
    tone === "success" ? "m5 12.5 4.5 4.5L19 7.5" : tone === "warning" ? "M12 6v8M12 18.5v.01" : "M6.5 6.5l11 11M17.5 6.5l-11 11";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={path} />
    </svg>
  );
}

interface ScanEvent {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  venue: string;
  poster_url?: string | null;
  status?: string;
  is_hidden?: boolean;
  /** Motif public d'une annulation ou d'une suspension. */
  reason?: string | null;
}

const HOUR = 3600_000;

/**
 * Événement présenté d'office à un agent : celui en cours, sinon le prochain,
 * sinon le plus récent. L'agent ne choisit pas : il contrôle l'événement
 * auquel il est affecté.
 */
function currentEvent(all: ScanEvent[], now = Date.now()): ScanEvent | undefined {
  // Un événement ouvert au contrôle passe avant un événement annulé ou fermé.
  const open = all.filter((e) => !scanEventStatus(e, now).closed);
  const list = open.length > 0 ? open : all;
  const endOf = (e: ScanEvent) => new Date(e.end_date ?? e.start_date).getTime() || new Date(e.start_date).getTime() + 6 * HOUR;
  const ongoing = list.find((e) => new Date(e.start_date).getTime() <= now && now <= endOf(e));
  if (ongoing) return ongoing;
  const upcoming = list.filter((e) => new Date(e.start_date).getTime() > now);
  if (upcoming.length) return upcoming[0];
  return list[list.length - 1];
}

/**
 * Affectations de l'agent, du plus proche au plus lointain : en cours, puis
 * à venir par date croissante ; les événements passés à part.
 */
function agentSchedule(list: ScanEvent[], now = Date.now()): { current: ScanEvent[]; past: ScanEvent[] } {
  const endOf = (e: ScanEvent) => new Date(e.end_date ?? e.start_date).getTime();
  const byStart = (a: ScanEvent, b: ScanEvent) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  return {
    current: list.filter((e) => endOf(e) >= now).sort(byStart),
    past: list.filter((e) => endOf(e) < now).sort((a, b) => byStart(b, a)),
  };
}

/** État du contrôle selon la fenêtre du paquet hors ligne (réglages admin). */
function checkpointState(pack: OfflinePack | null, now = Date.now()): { label: string; tone: "open" | "soon" | "closed" } | null {
  if (!pack) return null;
  if (pack.event.is_hidden || !["PUBLISHED", "TERMINATED"].includes(pack.event.status)) {
    return { label: "Événement fermé au public", tone: "closed" };
  }
  const opens = new Date(pack.event.start_date).getTime() - pack.scan_opens_before_minutes * 60_000;
  const closes = new Date(pack.event.end_date ?? pack.event.start_date).getTime() + pack.scan_closes_after_minutes * 60_000;
  if (now < opens) {
    const sameDay = new Date(opens).toDateString() === new Date(now).toDateString();
    return {
      label: `Contrôle ouvert ${sameDay ? `à ${timeOnly.format(new Date(opens))}` : `le ${dateTime.format(new Date(opens))}`}`,
      tone: "soon",
    };
  }
  if (now > closes) return { label: "Contrôle terminé", tone: "closed" };
  return { label: "Contrôle ouvert", tone: "open" };
}

interface Verdict {
  code: ScanResultCode | "ERROR";
  label: string;
  hint: string;
  tone: Tone;
  offline: boolean;
  holder?: string;
}

const timeWithSeconds = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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
  const [isAgent, setIsAgent] = useState(false);
  // Détails de l'événement contrôlé (affiche, fin), lus sur sa page publique.
  const [details, setDetails] = useState<{ poster_url: string | null; end_date: string | null } | null>(null);
  const [flash, setFlash] = useState(false);
  // Agent : liste de ses affectations (ouverte à la demande).
  const [showSchedule, setShowSchedule] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [paused, setPaused] = useState(false);
  // Scans de cet appareil depuis l'ouverture de la page (le plus récent en tête).
  const [history, setHistory] = useState<Array<Verdict & { at: number }>>([]);
  // Filtre de l'historique (clic sur un compteur du bilan).
  const [historyFilter, setHistoryFilter] = useState<Tone | null>(null);
  const [pending, setPending] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Entrées de l'événement selon le serveur (tous agents), avec l'heure de lecture.
  const [liveStats, setLiveStats] = useState<{ admitted: number; expected: number; at: Date } | null>(null);
  const lastCode = useRef<{ text: string; at: number } | null>(null);
  const syncing = useRef(false);

  // --- Événements à contrôler (organisateur : les siens ; agent : ses affectations)
  useEffect(() => {
    const role = getStoredUser()?.role;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rôle lu dans la session après le montage
    setIsAgent(role === "AGENT");
    // Même source complète pour les deux rôles : l'agent, ses affectations ;
    // l'organisateur, ses événements (hors brouillons, rien à contrôler).
    const load: Promise<ScanEvent[]> = (
      role === "AGENT"
        ? getAgentEvents()
        : getOrganizerScanEvents().then((list) => list.filter((e) => e.status !== "DRAFT"))
    ).then((list) =>
      list.map((e) => ({
        id: e.id,
        title: e.title,
        start_date: e.start_date,
        end_date: e.end_date,
        venue: `${e.venue_name}, ${e.venue_city}`,
        poster_url: e.poster_url,
        status: e.status,
        is_hidden: e.is_hidden,
        reason:
          e.status === "CANCELLED"
            ? e.cancellation_reason
            : e.status === "SUSPENDED"
              ? e.suspension_reason
              : e.status === "POSTPONED"
                ? (e.postponement_reason ?? null)
                : null,
      })),
    );
    load
      .then((list) => {
        const sorted = [...list].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        setEvents(sorted);
        // Même ouverture pour tous : l'événement en cours, sinon le prochain.
        // L'organisateur retrouve en plus son dernier choix.
        const remembered = role === "AGENT" ? null : readSelectedEvent();
        setEventId(
          remembered && sorted.some((e) => e.id === remembered) ? remembered : (currentEvent(sorted)?.id ?? null),
        );
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
          : "Pas de réseau : la liste enregistrée sur ce téléphone n'a pas pu être actualisée.",
      );
    } finally {
      setPackLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async (id: string) => {
    try {
      const stats = await getEntryStats(id);
      setLiveStats({ ...stats, at: new Date() });
    } catch {
      // Sans réseau : chiffres de la liste enregistrée sur le téléphone.
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
        void refreshStats(id);
      } catch {
        // Réseau encore instable : nouvel essai au prochain retour en ligne.
      } finally {
        syncing.current = false;
      }
    },
    [refreshPack, refreshStats],
  );

  // --- Changement d'événement : paquet local puis mise à jour, file d'attente
  useEffect(() => {
    if (!eventId) return;
    storeSelectedEvent(eventId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- paquet local lu après le montage
    setPack(loadPack(eventId));
    setPending(loadQueue(eventId).length);
    setHistory([]);
    setHistoryFilter(null);
    setVerdict(null);
    setSyncMessage(null);
    setDetails(null);
    setLiveStats(null);
    void refreshPack(eventId);
    void refreshStats(eventId);
    void syncQueue(eventId);
    getEvent(eventId)
      .then((e) => setDetails({ poster_url: e.poster_url, end_date: e.end_date }))
      .catch(() => undefined);
  }, [eventId, refreshPack, refreshStats, syncQueue]);

  // --- Entrées de l'événement relues régulièrement (scans des autres agents)
  useEffect(() => {
    if (!eventId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refreshStats(eventId);
    }, ENTRY_STATS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [eventId, refreshStats]);

  // --- Liste des billets tenue à jour sans bouton : au retour sur la page
  // (téléphone déverrouillé, autre application quittée) et au retour du réseau.
  useEffect(() => {
    if (!eventId) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void refreshPack(eventId);
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
    };
  }, [eventId, refreshPack]);

  // --- Retour du réseau : synchronisation automatique
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'état n'est modifié qu'après l'appel réseau
    if (online && eventId) void syncQueue(eventId);
  }, [online, eventId, syncQueue]);

  function show(next: Verdict) {
    setVerdict(next);
    setHistory((current) => [{ ...next, at: Date.now() }, ...current].slice(0, HISTORY_SIZE));
    setFlash(true);
    setTimeout(() => setFlash(false), VERDICT_DISPLAY_MS - 200);
    if (typeof navigator.vibrate === "function") navigator.vibrate(next.tone === "success" ? 120 : [90, 60, 90]);
    setTimeout(() => setPaused(false), VERDICT_DISPLAY_MS);
  }

  async function judgeOffline(text: string, id: string) {
    const current = loadPack(id);
    if (!current) {
      show({ code: "ERROR", label: "Pas de réseau", hint: "La liste des billets n'est pas encore enregistrée sur ce téléphone : reconnectez-vous pour l'obtenir.", tone: "danger", offline: true });
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
      if (response.result === "SUCCESS") void refreshStats(eventId);
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
  // Seule différence entre les rôles : l'organisateur choisit l'événement
  // contrôlé ; l'agent contrôle celui de son affectation en cours.
  const canChoose = !isAgent;
  // Erreurs techniques (réseau, navigateur) hors bilan : ce ne sont pas des billets refusés.
  const judged = history.filter((item) => item.code !== "ERROR");
  const entered = judged.filter((item) => item.tone === "success").length;
  const refused = judged.filter((item) => item.tone === "danger").length;
  const toCheck = judged.filter((item) => item.tone === "warning").length;
  const poster = details?.poster_url ?? selected?.poster_url ?? null;
  const checkpoint = checkpointState(pack);
  // En ligne : chiffres du serveur ; sinon, liste enregistrée sur ce téléphone.
  const entryStats =
    liveStats && online
      ? { admitted: liveStats.admitted, expected: liveStats.expected, live: true, at: liveStats.at }
      : pack
        ? {
            admitted: pack.tickets.filter((t) => t.status === "USED").length,
            expected: pack.tickets.filter((t) => !NOT_EXPECTED.has(t.status)).length,
            live: false,
            at: new Date(pack.generated_at),
          }
        : null;
  const selectedStatus = selected ? scanEventStatus({ ...selected, end_date: details?.end_date ?? selected.end_date }) : null;
  const closedNotice = selected && selectedStatus ? closedEventNotice(selectedStatus.key, selected.reason) : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {/* Keyframes du trait de visée */}
      <style>{`@keyframes btx-scanline { 0%, 100% { top: 12%; } 50% { top: 84%; } }`}</style>

      {/* En-tête : événement contrôlé */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- fond décoratif, affiche hébergée sur MinIO
          <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-50 blur-2xl" />
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/60 via-slate-950/80 to-blue-950/90" />

        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Contrôle d&apos;accès</p>
          <div className="flex items-center gap-2">
          {isAgent ? (
            // Mobile : l'en-tête du site masque le menu agent, accès au compte ici.
            <Link
              href="/profil"
              aria-label="Mon compte"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 sm:hidden"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" />
              </svg>
            </Link>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              online ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/20 text-amber-200"
            }`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
            {online ? "En ligne" : "Hors ligne"}
          </span>
          </div>
        </div>

        <div className="flex items-center gap-4 px-5 pb-5 pt-3">
          <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden="true">🎫</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {selected ? (
              <>
                <h1 className="truncate text-lg font-bold leading-tight">{selected.title}</h1>
                <p className="mt-0.5 truncate text-sm text-white/70">
                  {dateTime.format(new Date(selected.start_date))} · {selected.venue}
                </p>
                {closedNotice && selectedStatus ? (
                  <span className={`mt-2 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold ${selectedStatus.badge.split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}>
                    {selectedStatus.label}
                  </span>
                ) : checkpoint ? (
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      checkpoint.tone === "open"
                        ? "bg-emerald-500 text-white"
                        : checkpoint.tone === "soon"
                          ? "bg-amber-400 text-slate-950"
                          : "bg-white/15 text-white/80"
                    }`}
                  >
                    {checkpoint.label}
                  </span>
                ) : null}
              </>
            ) : (
              <h1 className="text-lg font-bold">Scan des billets</h1>
            )}
          </div>
        </div>

        {/* Mes événements (agent : ses affectations ; organisateur : les siens) */}
        {events && events.length > 0 ? (
          <div className="border-t border-white/10 px-5 py-3">
            <button
              type="button"
              aria-expanded={showSchedule}
              onClick={() => setShowSchedule((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              <span>Mes événements ({events.length})</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`transition-transform ${showSchedule ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        ) : null}

      </section>

      {showSchedule && events ? (
        <section aria-label="Mes événements" className={cardClass("overflow-hidden")}>
          {(() => {
            const { current, past } = agentSchedule(events);
            const row = (e: ScanEvent, isPast: boolean) => {
              const active = e.id === eventId;
              const status = scanEventStatus(e);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={!canChoose}
                    onClick={() => {
                      setEventId(e.id);
                      setShowSchedule(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default ${
                      active ? "bg-blue-500/5" : canChoose ? "hover:bg-hairline-1" : ""
                    }`}
                  >
                  <div className="h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-hairline-2">
                    {e.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO
                      <img src={e.poster_url} alt="" className={`h-full w-full object-cover ${isPast ? "opacity-50 grayscale" : ""}`} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${isPast || status.closed ? "text-ink-4" : "text-ink-1"} ${
                        status.key === "CANCELLED" ? "line-through" : ""
                      }`}
                    >
                      {e.title}
                    </p>
                    <p className="truncate text-xs text-ink-5">
                      {dateTime.format(new Date(e.start_date))} · {e.venue}
                    </p>
                    {active && status.key === "ONGOING" ? (
                      <p className="mt-0.5 text-xs font-semibold text-blue-600">Contrôle en cours</p>
                    ) : active && status.key === "UPCOMING" ? (
                      <p className="mt-0.5 text-xs font-semibold text-blue-600">Prochain contrôle</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.badge}`}>{status.label}</span>
                  </div>
                  </button>
                </li>
              );
            };
            return (
              <>
                <div className="border-b border-hairline-1 px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-5">À venir · du plus proche au plus lointain</p>
                  {canChoose ? <p className="mt-0.5 text-[11px] text-ink-5">Touchez un événement pour le contrôler.</p> : null}
                </div>
                {current.length > 0 ? (
                  <ul className="divide-y divide-hairline-1">{current.map((e) => row(e, false))}</ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-ink-5">Aucun événement à venir.</p>
                )}
                {past.length > 0 ? (
                  <>
                    <p className="border-y border-hairline-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-5">
                      Passés
                    </p>
                    <ul className="divide-y divide-hairline-1">{past.map((e) => row(e, true))}</ul>
                  </>
                ) : null}
              </>
            );
          })()}
        </section>
      ) : null}

      {eventsError ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-danger">{eventsError}</p>
      ) : events === null ? (
        <div className="aspect-square w-full animate-pulse rounded-3xl bg-hairline-1" />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-hairline-2 bg-card px-6 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">🛡️</span>
          <p className="font-semibold text-ink-1">
            {isAgent ? "Aucun événement ne vous est assigné" : "Aucun événement à contrôler"}
          </p>
          <p className="text-sm text-ink-5">
            {isAgent
              ? "L'organisateur doit vous assigner à son événement pour que vous puissiez scanner les billets."
              : "Vos événements publiés apparaîtront ici."}
          </p>
        </div>
      ) : selected && closedNotice ? (
        <div
          role="status"
          className={`flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center ${
            selectedStatus?.key === "CANCELLED" ? "bg-red-500/10 ring-1 ring-inset ring-red-500/25" : "bg-amber-500/10 ring-1 ring-inset ring-amber-500/30"
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-14 w-14 items-center justify-center rounded-full text-white ${selectedStatus?.key === "CANCELLED" ? "bg-red-600" : "bg-amber-500"}`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {selectedStatus?.key === "CANCELLED" ? <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> : <path d="M12 6v8M12 18.5v.01" />}
            </svg>
          </span>
          <p className="text-lg font-bold text-ink-1">{closedNotice.title}</p>
          <p className="max-w-sm text-sm text-ink-3">{closedNotice.text}</p>
          {closedNotice.reason ? (
            <p className="max-w-sm rounded-xl bg-card/70 px-4 py-2 text-sm text-ink-2">
              <span className="font-semibold">Motif : </span>
              {closedNotice.reason}
            </p>
          ) : null}
          {events && events.length > 1 ? (
            <p className="text-xs text-ink-5">Vos autres événements sont dans « Mes événements ».</p>
          ) : null}
        </div>
      ) : selected ? (
        <>
          {/* Caméra */}
          <div className="relative">
            {cameraOn ? (
              <CameraScanner onCode={(text) => void handleCode(text)} paused={paused} />
            ) : (
              <button
                type="button"
                onClick={() => setCameraOn(true)}
                className="group flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-3xl bg-slate-900 text-white shadow-xl transition-transform active:scale-[0.99]"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-900/50 transition-transform group-hover:scale-105">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" />
                  </svg>
                </span>
                <span className="text-base font-semibold">Démarrer le scan</span>
                <span className="text-xs text-white/60">La caméra arrière de l&apos;appareil s&apos;ouvre</span>
              </button>
            )}

            {cameraOn && !paused ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[20%] h-0.5 rounded-full bg-blue-400 shadow-[0_0_12px_3px_rgba(96,165,250,0.8)]"
                style={{ animation: "btx-scanline 2.4s ease-in-out infinite" }}
              />
            ) : null}

            {/* Verdict plein cadre pendant son affichage */}
            {verdict && flash ? (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl px-6 text-center shadow-2xl ${TONE_STYLES[verdict.tone]}`}
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-5xl font-black" aria-hidden="true">
                  <VerdictIcon tone={verdict.tone} className="h-3/5 w-3/5" />
                </span>
                <p className="text-3xl font-extrabold leading-tight">{verdict.label}</p>
                {verdict.holder ? <p className="text-lg font-semibold">{verdict.holder}</p> : null}
                <p className="text-sm opacity-90">{verdict.hint}</p>
                {verdict.offline ? (
                  <span className="rounded-full bg-black/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">Vérifié hors ligne</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Dernier verdict (rappel discret) */}
          <div role="status" aria-live="assertive" className={cardClass("px-4 py-3")}>
            {verdict ? (
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black ${TONE_STYLES[verdict.tone]}`}
                  aria-hidden="true"
                >
                  <VerdictIcon tone={verdict.tone} className="h-3/5 w-3/5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-1">
                    {verdict.label}
                    {verdict.holder ? ` — ${verdict.holder}` : ""}
                  </p>
                  <p className="truncate text-xs text-ink-5">
                    {verdict.offline ? "Vérifié hors ligne · " : ""}
                    {verdict.hint}
                  </p>
                </div>
              </div>
            ) : (
              <MutedMessage>
                {cameraOn
                  ? "Visez le QR code affiché sur le téléphone du participant."
                  : "Démarrez le scan, puis visez le QR code affiché sur le téléphone du participant."}
              </MutedMessage>
            )}
          </div>

          {entryStats ? (
            <EntryProgress
              admitted={entryStats.admitted}
              expected={entryStats.expected}
              live={entryStats.live}
              updatedAt={entryStats.at}
            />
          ) : null}

          {/* Bilan de l'appareil : entrées, refus, cas à vérifier */}
          <div>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-5">
              Bilan de cet appareil
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { tone: "success", label: entered > 1 ? "Entrées" : "Entrée", value: entered, color: "text-emerald-600", ring: "border-emerald-500/30" },
                  { tone: "danger", label: refused > 1 ? "Refusés" : "Refusé", value: refused, color: "text-red-600", ring: "border-red-500/30" },
                  { tone: "warning", label: "À vérifier", value: toCheck, color: "text-amber-500", ring: "border-amber-500/30" },
                ] as const
              ).map((item) => (
                <button
                  key={item.tone}
                  type="button"
                  aria-pressed={historyFilter === item.tone}
                  disabled={item.value === 0}
                  onClick={() => setHistoryFilter((current) => (current === item.tone ? null : item.tone))}
                  className={`rounded-2xl border bg-card px-3 py-3 text-center transition-all disabled:cursor-default ${
                    item.value > 0 ? item.ring : "border-hairline-1"
                  } ${historyFilter === item.tone ? "ring-2 ring-offset-2 ring-offset-page ring-current " + item.color : ""}`}
                >
                  <p className={`text-2xl font-extrabold ${item.value > 0 ? item.color : "text-ink-4"}`}>{item.value}</p>
                  <p className="text-xs font-semibold text-ink-2">{item.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Envoi au serveur des entrées validées sans réseau */}
          {pending > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-1">
                  {pending} {pending > 1 ? "entrées à envoyer" : "entrée à envoyer"}
                </p>
                <p className="text-xs text-ink-5">Validées sans réseau : envoyées automatiquement au retour de la connexion.</p>
              </div>
              {online ? (
                <button
                  type="button"
                  onClick={() => eventId && syncQueue(eventId)}
                  className="shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Envoyer
                </button>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-emerald-600">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
              Toutes les entrées sont enregistrées sur le serveur.
            </p>
          )}

          {/* Historique des scans */}
          {history.length > 0 ? (
            <div className={cardClass("overflow-hidden")}>
              <div className="flex items-center justify-between gap-3 border-b border-hairline-1 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-5">
                  Derniers scans
                  {historyFilter
                    ? ` · ${historyFilter === "success" ? "entrées" : historyFilter === "danger" ? "refusés" : "à vérifier"}`
                    : ""}
                </p>
                {historyFilter ? (
                  <button type="button" onClick={() => setHistoryFilter(null)} className="text-xs font-semibold text-link hover:text-link-hover">
                    Tout afficher
                  </button>
                ) : null}
              </div>
              <ul className="max-h-80 divide-y divide-hairline-1 overflow-y-auto">
                {history
                  .filter((item) => !historyFilter || (item.tone === historyFilter && item.code !== "ERROR"))
                  .map((item, index) => (
                  <li key={`${item.at}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${TONE_STYLES[item.tone]}`}
                    >
                      <VerdictIcon tone={item.tone} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-1">{item.label}</p>
                      <p className="truncate text-xs text-ink-5">
                        {item.holder ?? item.hint}
                        {item.offline ? " · sans réseau" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-ink-5">{timeWithSeconds.format(new Date(item.at))}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Contrôle sans réseau : liste des billets enregistrée sur l'appareil */}
          {(() => {
            const count = pack?.tickets.length ?? 0;
            const state = !pack
              ? { label: "À préparer", className: "bg-amber-500/15 text-amber-600" }
              : count === 0
                ? { label: "Rien à vérifier", className: "bg-hairline-2 text-ink-3" }
                : { label: "Prêt", className: "bg-emerald-500/15 text-emerald-600" };
            return (
              <section aria-label="Contrôle sans réseau" className={cardClass("p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 8.8a15 15 0 0 1 20 0M5.5 12.4a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01" />
                        <path d="M3 3l18 18" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink-1">Contrôle sans réseau</p>
                      <p className="text-xs text-ink-5">Si la connexion coupe, ce téléphone vérifie seul les billets.</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.className}`}>{state.label}</span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-hairline-1 px-3 py-2.5">
                    <dt className="text-[11px] font-medium text-ink-5">Billets vérifiables</dt>
                    <dd className="text-base font-bold text-ink-1">
                      {pack ? `${count} billet${count > 1 ? "s" : ""}` : "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-hairline-1 px-3 py-2.5">
                    <dt className="text-[11px] font-medium text-ink-5">Liste actualisée à</dt>
                    <dd className="text-base font-bold text-ink-1">{pack ? timeOnly.format(new Date(pack.generated_at)) : "—"}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-5">
                    {!pack
                      ? "Connectez-vous pour enregistrer la liste sur ce téléphone."
                      : count === 0
                        ? "Aucun billet vendu pour l'instant."
                        : "Actualisée automatiquement à chaque retour sur la page."}
                  </p>
                  <button
                    type="button"
                    disabled={packLoading || !online}
                    onClick={() => eventId && refreshPack(eventId)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline-3 px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={packLoading ? "animate-spin" : ""}
                    >
                      <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
                    </svg>
                    {packLoading ? "Actualisation…" : "Actualiser"}
                  </button>
                </div>
                {packError ? <p className="mt-2 text-xs text-amber-600">{packError}</p> : null}
              </section>
            );
          })()}

          {syncMessage ? <p className="text-center text-xs text-ink-4">{syncMessage}</p> : null}

          {cameraOn ? (
            <button
              type="button"
              onClick={() => setCameraOn(false)}
              className={buttonClass("secondary", "rounded-full py-3 text-sm")}
            >
              Arrêter la caméra
            </button>
          ) : null}
        </>
      ) : (
        <p className={cardClass("px-4 py-6 text-center text-sm text-ink-5")}>
          Choisissez l&apos;événement à contrôler.
        </p>
      )}
    </div>
  );
}
