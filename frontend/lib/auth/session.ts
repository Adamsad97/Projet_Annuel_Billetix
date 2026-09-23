// Stockage de session côté client (localStorage) — le backend renvoie les
// tokens dans le corps de la réponse JSON (pas de cookie httpOnly posé par
// l'api-gateway), donc c'est au frontend de les conserver pour les requêtes
// authentifiées ultérieures.

import type { AuthSession, AuthUser } from "@/lib/api/auth";

const ACCESS_TOKEN_KEY = "billetix_access_token";
const REFRESH_TOKEN_KEY = "billetix_refresh_token";
const USER_KEY = "billetix_user";

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
