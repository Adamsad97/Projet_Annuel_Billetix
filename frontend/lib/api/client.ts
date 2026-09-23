// Petit client fetch partagé — gère le token d'authentification (Bearer)
// et le format d'erreur uniforme de l'api-gateway.

import { getApiBaseUrl } from "./base-url";
import { ApiError, extractErrorMessage } from "./http-error";
import { getAccessToken, getRefreshToken, updateTokens, clearSession } from "@/lib/auth/session";
import { refreshTokens } from "./auth";

const API_URL = getApiBaseUrl();

// Bug corrigé : un access token expiré (courte durée de vie) faisait
// échouer la requête avec le message brut du guard JWT ("Token invalide ou
// expiré"), affiché tel quel à l'utilisateur en pleine navigation — ni
// professionnel, ni compréhensible. On tente maintenant un rafraîchissement
// silencieux via le refresh token (longue durée) avant d'abandonner.
//
// Une seule tentative de refresh à la fois : les requêtes concurrentes qui
// essuient un 401 pendant qu'un refresh est déjà en cours attendent son
// résultat plutôt que d'en déclencher un chacune (le refresh token tourne à
// usage unique côté serveur — un deuxième appel simultané l'invaliderait).
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const currentRefreshToken = getRefreshToken();
      if (!currentRefreshToken) return null;
      try {
        const result = await refreshTokens(currentRefreshToken);
        updateTokens(result.access_token, result.refresh_token);
        return result.access_token;
      } catch {
        clearSession();
        return null;
      }
    })();
  }
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.",
    );
  }

  if (response.status === 401 && !isRetry && token) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, true);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Ta session a expiré — reconnecte-toi pour continuer."
        : extractErrorMessage(data, "Une erreur est survenue, réessaie."),
    );
  }

  return data as T;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body });
export const apiDelete = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "DELETE", body });
export const apiPatch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body });
