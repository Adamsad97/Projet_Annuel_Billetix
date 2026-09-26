// Stockage de session côté client (localStorage) — le backend renvoie les
// tokens dans le corps de la réponse JSON (pas de cookie httpOnly posé par
// l'api-gateway), donc c'est au frontend de les conserver pour les requêtes
// authentifiées ultérieures.

import type { AuthSession, AuthUser } from "@/lib/api/auth";

const ACCESS_TOKEN_KEY = "billetix_access_token";
const REFRESH_TOKEN_KEY = "billetix_refresh_token";
const USER_KEY = "billetix_user";
// Partagées entre onglets (localStorage) : une activité dans un onglet
// maintient la session de tous, une fin de session les déconnecte tous.
const LAST_ACTIVITY_KEY = "billetix_last_activity";
const END_REASON_KEY = "billetix_session_end_reason";

/** Pourquoi la session s'est terminée (message affiché à la connexion). */
export type SessionEndReason = "manuelle" | "inactivite" | "duree_max" | "expiree";
export const SESSION_ENDED_EVENT = "billetix:session-ended";

// persist=true (« Se souvenir de moi ») -> localStorage, survit à la
// fermeture du navigateur. persist=false -> sessionStorage, effacé à la
// fermeture de l'onglet.
export function saveSession(session: AuthSession, persist = true): void {
  if (typeof window === "undefined") return;
  const store = persist ? window.localStorage : window.sessionStorage;
  const other = persist ? window.sessionStorage : window.localStorage;
  other.removeItem(ACCESS_TOKEN_KEY);
  other.removeItem(REFRESH_TOKEN_KEY);
  other.removeItem(USER_KEY);
  store.setItem(ACCESS_TOKEN_KEY, session.access_token);
  store.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  store.setItem(USER_KEY, JSON.stringify(session.user));
  window.localStorage.removeItem(END_REASON_KEY);
  markActivity();
}

/**
 * Termine la session côté navigateur et prévient l'application : cet
 * onglet via un événement, les autres via l'événement `storage` (clé
 * END_REASON_KEY). La révocation serveur, elle, est faite par logout().
 */
export function endSession(reason: SessionEndReason): void {
  if (typeof window === "undefined") return;
  const hadSession = getAccessToken() !== null;
  clearSession();
  if (!hadSession) return;
  window.localStorage.setItem(END_REASON_KEY, reason);
  window.dispatchEvent(new CustomEvent<SessionEndReason>(SESSION_ENDED_EVENT, { detail: reason }));
}

export function getSessionEndReason(): SessionEndReason | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(END_REASON_KEY) as SessionEndReason | null;
}

export function markActivity(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastActivity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  return raw ? Number(raw) : null;
}

function refreshTokenPayload(): { iat?: number; auth_time?: number } | null {
  const token = getRefreshToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Heure (ms) de la connexion d'origine — conservée à chaque rotation. */
export function getSessionStartedAt(): number | null {
  const payload = refreshTokenPayload();
  const seconds = payload?.auth_time ?? payload?.iat;
  return typeof seconds === "number" ? seconds * 1000 : null;
}

/**
 * Date d'émission (ms) du refresh token courant — renouvelé à chaque
 * rafraîchissement, donc « dernier rafraîchissement ». Lecture du payload
 * JWT sans vérification de signature : sert uniquement à décider quand
 * rafraîchir, le serveur reste seul juge de la validité.
 */
export function getRefreshTokenIssuedAt(): number | null {
  const iat = refreshTokenPayload()?.iat;
  return typeof iat === "number" ? iat * 1000 : null;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    store.removeItem(ACCESS_TOKEN_KEY);
    store.removeItem(REFRESH_TOKEN_KEY);
    store.removeItem(USER_KEY);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(REFRESH_TOKEN_KEY) ??
    window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  );
}

// Remplace uniquement les tokens (rotation après un refresh) — préserve
// l'utilisateur déjà stocké et le choix localStorage/sessionStorage fait à
// la connexion (persist). Ne fait rien si aucune session n'existe déjà.
export function updateTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  const inLocal = window.localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
  const store = inLocal ? window.localStorage : window.sessionStorage;
  if (store.getItem(ACCESS_TOKEN_KEY) === null) return;
  store.setItem(ACCESS_TOKEN_KEY, accessToken);
  store.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.localStorage.getItem(USER_KEY) ??
    window.sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
