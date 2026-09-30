"use client";

// Console de contrôle d'accès : choix de l'événement, paquet hors ligne,
// caméra, verdict en grand. En ligne, le serveur juge chaque scan ; sans
// réseau, l'appareil vérifie lui-même la signature du QR avec le paquet
// hors ligne, puis synchronise dès le retour du réseau (le serveur revérifie).

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraScanner } from "@/components/scan/camera-scanner";
import { getEvent } from "@/lib/api/events";
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
  end_date?: string | null;
  venue: string;
  poster_url?: string | null;
}

const HOUR = 3600_000;

/**
 * Événement présenté d'office à un agent : celui en cours, sinon le prochain,
 * sinon le plus récent. L'agent ne choisit pas : il contrôle l'événement
 * auquel il est affecté.
 */
function currentEvent(list: ScanEvent[], now = Date.now()): ScanEvent | undefined {
  const endOf = (e: ScanEvent) => new Date(e.end_date ?? e.start_date).getTime() || new Date(e.start_date).getTime() + 6 * HOUR;
  const ongoing = list.find((e) => new Date(e.start_date).getTime() <= now && now <= endOf(e));
  if (ongoing) return ongoing;
  const upcoming = list.filter((e) => new Date(e.start_date).getTime() > now);
  if (upcoming.length) return upcoming[0];
  return list[list.length - 1];
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
  const [isAgent, setIsAgent] = useState(false);
  // Détails de l'événement contrôlé (affiche, fin), lus sur sa page publique.
  const [details, setDetails] = useState<{ poster_url: string | null; end_date: string | null } | null>(null);
  const [flash, setFlash] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rôle lu dans la session après le montage
    setIsAgent(role === "AGENT");
    const load: Promise<ScanEvent[]> =
      role === "AGENT"
        ? getAgentEvents().then((list) =>
            list.map((e) => ({
              id: e.id,
              title: e.title,
              start_date: e.start_date,
              end_date: e.end_date,
              venue: `${e.venue_name}, ${e.venue_city}`,
              poster_url: e.poster_url,
            })),
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
        if (role === "AGENT") {
          // L'agent ne choisit pas : son événement s'ouvre directement.
          setEventId(currentEvent(sorted)?.id ?? null);
          return;
        }
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
    setDetails(null);
    void refreshPack(eventId);
    void syncQueue(eventId);
    getEvent(eventId)
      .then((e) => setDetails({ poster_url: e.poster_url, end_date: e.end_date }))
      .catch(() => undefined);
  }, [eventId, refreshPack, syncQueue]);

  // --- Retour du réseau : synchronisation automatique
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- l'état n'est modifié qu'après l'appel réseau
    if (online && eventId) void syncQueue(eventId);
  }, [online, eventId, syncQueue]);

  function show(next: Verdict) {
    setVerdict(next);
    setFlash(true);
    setTimeout(() => setFlash(false), VERDICT_DISPLAY_MS - 200);
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
  const poster = details?.poster_url ?? selected?.poster_url ?? null;
  const checkpoint = checkpointState(pack);

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
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              online ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/20 text-amber-200"
            }`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
            {online ? "En ligne" : "Hors ligne"}
          </span>
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
                {checkpoint ? (
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

        {/* Organisateur : choix parmi ses événements (l'agent, lui, n'a que le sien) */}
        {!isAgent && events && events.length > 0 ? (
          <div className="border-t border-white/10 px-5 py-3">
            <label className="sr-only" htmlFor="scan-event">Événement contrôlé</label>
            <select
              id="scan-event"
              value={eventId ?? ""}
              onChange={(e) => setEventId(e.target.value || null)}
              className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white focus:border-white/40 focus:outline-none"
            >
              <option value="" className="text-slate-900">Choisir l&apos;événement à contrôler…</option>
              {events.map((e) => (
                <option key={e.id} value={e.id} className="text-slate-900">
                  {e.title} — {dateTime.format(new Date(e.start_date))}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

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
                  {verdict.tone === "success" ? "✓" : verdict.tone === "warning" ? "!" : "✕"}
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
          <div role="status" aria-live="assertive" className="rounded-2xl border border-hairline-1 bg-card px-4 py-3">
            {verdict ? (
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black ${TONE_STYLES[verdict.tone]}`}
                  aria-hidden="true"
                >
                  {verdict.tone === "success" ? "✓" : verdict.tone === "warning" ? "!" : "✕"}
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
              <p className="text-center text-sm text-ink-5">
                {cameraOn
                  ? "Visez le QR code affiché sur le téléphone du participant."
                  : "Démarrez le scan, puis visez le QR code affiché sur le téléphone du participant."}
              </p>
            )}
          </div>

          {/* Bilan de l'appareil */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-hairline-1 bg-card p-4">
              <p className="text-3xl font-extrabold text-emerald-600">{validated}</p>
              <p className="text-sm font-semibold text-ink-1">
                {validated > 1 ? "personnes entrées" : "personne entrée"}
              </p>
              <p className="mt-0.5 text-xs text-ink-5">avec cet appareil, depuis l&apos;ouverture de la page</p>
            </div>
            {pending > 0 ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
                <p className="text-3xl font-extrabold text-amber-500">{pending}</p>
                <p className="text-sm font-semibold text-ink-1">{pending > 1 ? "entrées à envoyer" : "entrée à envoyer"}</p>
                <p className="mt-0.5 text-xs text-ink-5">
                  Validées sans réseau : envoyées automatiquement au retour de la connexion.
                </p>
                {online ? (
                  <button
                    type="button"
                    onClick={() => eventId && syncQueue(eventId)}
                    className="mt-2 text-xs font-semibold text-link hover:text-link-hover"
                  >
                    Envoyer maintenant
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-hairline-1 bg-card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <p className="text-sm font-semibold text-ink-1">Tout est envoyé</p>
                <p className="mt-0.5 text-xs text-ink-5">Aucune entrée en attente d&apos;envoi au serveur.</p>
              </div>
            )}
          </div>

          {/* Paquet hors ligne */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline-1 bg-card px-4 py-3 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-ink-2">Contrôle sans réseau</p>
              <p className="text-ink-5">
                {pack
                  ? `Prêt : ${pack.tickets.length} billet${pack.tickets.length > 1 ? "s" : ""} vérifiable${pack.tickets.length > 1 ? "s" : ""} même sans connexion (liste du ${timeOnly.format(new Date(pack.generated_at))})`
                  : "Pas encore prêt : connectez-vous pour télécharger la liste des billets"}
              </p>
              {packError ? <p className="mt-0.5 text-amber-600">{packError}</p> : null}
            </div>
            <button
              type="button"
              disabled={packLoading || !online}
              onClick={() => eventId && refreshPack(eventId)}
              className="shrink-0 rounded-full border border-hairline-3 px-3 py-1.5 font-semibold text-ink-2 transition-colors hover:border-hairline-5 disabled:opacity-50"
            >
              {packLoading ? "Mise à jour…" : "Mettre à jour"}
            </button>
          </div>

          {syncMessage ? <p className="text-center text-xs text-ink-4">{syncMessage}</p> : null}

          {cameraOn ? (
            <button
              type="button"
              onClick={() => setCameraOn(false)}
              className="rounded-full border border-hairline-3 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Arrêter la caméra
            </button>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-hairline-1 bg-card px-4 py-6 text-center text-sm text-ink-5">
          Choisissez l&apos;événement à contrôler.
        </p>
      )}
    </div>
  );
}
