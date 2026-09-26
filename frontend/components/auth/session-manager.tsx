"use client";

// Gestion de la session côté navigateur (monté une fois, layout racine).
// Bugs corrigés : une session ne s'arrêtait jamais d'elle-même (refresh
// token de 30 jours renouvelé en silence, quelle que soit l'inactivité), et
// quand elle expirait malgré tout, l'interface continuait d'afficher un
// compte connecté — sans redirection, juste des erreurs au clic suivant.
//
// - Inactivité : au-delà de session_idle_timeout_minutes (platform_settings,
//   aussi vérifié par auth-service au refresh), déconnexion automatique.
//   Avertissement une minute avant, avec « Rester connecté ».
// - Activité : partagée entre onglets (localStorage) ; tant qu'elle dure, la
//   session est rafraîchie au plus tard à mi-délai, pour que le serveur la
//   considère active.
// - Fin de session (inactivité, refresh refusé, déconnexion dans un autre
//   onglet) : redirection vers /connexion avec le motif.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSessionPolicy } from "@/lib/api/auth";
import { refreshAccessToken } from "@/lib/api/client";
import { logout } from "@/lib/auth/logout";
import {
  SESSION_ENDED_EVENT,
  getAccessToken,
  getLastActivity,
  getRefreshTokenIssuedAt,
  getSessionEndReason,
  getSessionStartedAt,
  markActivity,
  type SessionEndReason,
} from "@/lib/auth/session";

// Valeur de repli uniquement (API injoignable) — identique au FALLBACK
// d'auth-service ; la vraie valeur vient de platform_settings.
const FALLBACK_IDLE_MINUTES = 30;
const FALLBACK_MAX_HOURS = 12;
// Réglages d'interface (pas des paramètres métier).
const WARNING_BEFORE_MS = 60_000;
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const TICK_MS = 1_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

export function SessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [idleMs, setIdleMs] = useState(FALLBACK_IDLE_MINUTES * 60_000);
  // Durée maximale depuis la connexion, même en restant actif (ordinateur
  // prêté ou laissé ouvert) — aussi vérifiée par auth-service au refresh.
  const [maxMs, setMaxMs] = useState(FALLBACK_MAX_HOURS * 3_600_000);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const refreshing = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    getSessionPolicy()
      .then((policy) => {
        setIdleMs(policy.idle_timeout_minutes * 60_000);
        setMaxMs(policy.max_duration_hours * 3_600_000);
      })
      .catch(() => undefined);
  }, []);

  // Redirection à la fin de session, quelle qu'en soit l'origine.
  useEffect(() => {
    function goToLogin(reason: SessionEndReason) {
      setSecondsLeft(null);
      if (reason === "manuelle") return; // le bouton gère sa propre navigation
      if (!window.location.pathname.startsWith("/connexion")) {
        // Inactivité : déconnexion silencieuse, sans message.
        router.replace(reason === "inactivite" ? "/connexion" : `/connexion?session=${reason}`);
      }
    }
    const onEnded = (event: Event) => goToLogin((event as CustomEvent<SessionEndReason>).detail);
    // Autre onglet : sa fin de session vide le stockage partagé.
    const onStorage = (event: StorageEvent) => {
      if (event.key === "billetix_access_token" && event.newValue === null && !getAccessToken()) {
        const reason = getSessionEndReason() ?? "expiree";
        if (reason === "manuelle") {
          window.location.assign("/");
        } else {
          goToLogin(reason);
        }
      }
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener("storage", onStorage);
    };
  }, [router]);

  // Suivi de l'activité (écriture limitée, partagée entre onglets).
  useEffect(() => {
    const onActivity = () => {
      if (!getAccessToken()) return;
      const now = Date.now();
      if (now - lastWrite.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite.current = now;
      markActivity();
    };
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { passive: true });
    return () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity);
    };
  }, []);

  // Horloge : avertissement, déconnexion pour inactivité, refresh proactif.
  useEffect(() => {
    ended.current = false;
    const timer = window.setInterval(() => {
      if (!getAccessToken() || ended.current) {
        setSecondsLeft(null);
        return;
      }

      const startedAt = getSessionStartedAt();
      if (startedAt !== null && Date.now() - startedAt >= maxMs) {
        ended.current = true;
        setSecondsLeft(null);
        void logout("duree_max");
        return;
      }

      const lastActivity = getLastActivity() ?? Date.now();
      const idleFor = Date.now() - lastActivity;

      if (idleFor >= idleMs) {
        ended.current = true;
        setSecondsLeft(null);
        void logout("inactivite");
        return;
      }

      const remaining = idleMs - idleFor;
      setSecondsLeft(remaining <= WARNING_BEFORE_MS ? Math.ceil(remaining / 1000) : null);

      // Actif récemment et dernier refresh à mi-délai : on rafraîchit, pour
      // que le contrôle d'inactivité côté serveur voie la session active.
      const issuedAt = getRefreshTokenIssuedAt();
      if (
        !refreshing.current &&
        idleFor < WARNING_BEFORE_MS &&
        issuedAt !== null &&
        Date.now() - issuedAt > idleMs / 2
      ) {
        refreshing.current = true;
        void refreshAccessToken().finally(() => {
          refreshing.current = false;
        });
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [idleMs, maxMs, pathname]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title">
      <div className="w-full max-w-sm rounded-2xl border border-hairline-2 bg-card p-6 text-center shadow-2xl">
        <h2 id="session-warning-title" className="text-lg font-bold text-ink-1">
          Ta session va expirer
        </h2>
        <p className="mt-2 text-sm text-ink-4">
          Par sécurité, tu seras déconnecté faute d&apos;activité dans{" "}
          <strong className="font-mono tabular-nums text-warning">{secondsLeft} s</strong>.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              void logout("manuelle").then(() => router.push("/"));
            }}
            className="flex-1 rounded-xl border border-hairline-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5"
          >
            Se déconnecter
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              markActivity();
              setSecondsLeft(null);
              void refreshAccessToken();
            }}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Rester connecté
          </button>
        </div>
      </div>
    </div>
  );
}
