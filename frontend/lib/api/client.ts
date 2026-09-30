// Petit client fetch partagé — gère le token d'authentification (Bearer)
// et le format d'erreur uniforme de l'api-gateway.

import { getApiBaseUrl } from "./base-url";
import { ApiError, extractErrorCode, extractErrorMessage } from "./http-error";
import { isPreviewActive, PREVIEW_READ_ONLY_MESSAGE } from "@/lib/auth/preview";
import { endSession, getAccessToken, getRefreshToken, updateTokens } from "@/lib/auth/session";
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
      } catch (err) {
        // Serveur injoignable ou en erreur (redémarrage, réseau) : la
        // session n'est pas en cause — on la garde, seule la requête échoue.
        // Bug corrigé : toute panne déconnectait avec « session expirée ».
        if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500) {
          return null;
        }
        // Refus réel du serveur : vraie déconnexion, avec le bon motif —
        // l'inactivité reste silencieuse (demande produit).
        endSession(
          err.code === "SESSION_IDLE" ? "inactivite" : err.code === "SESSION_MAX_DURATION" ? "duree_max" : "expiree",
        );
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
  // Mode aperçu du back-office : consultation uniquement, aucune
  // modification ne part vers le serveur.
  if ((options.method ?? "GET") !== "GET" && isPreviewActive()) {
    throw new ApiError(403, PREVIEW_READ_ONLY_MESSAGE, "PREVIEW_READ_ONLY");
  }
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
      "Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard.",
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
    // Bug corrigé : « Ta session a expiré » s'affichait aussi quand il n'y
    // avait jamais eu de session (visiteur non connecté).
    throw new ApiError(
      response.status,
      response.status === 401
        ? !token
          ? "Vous devez être connecté pour accéder à cette page."
          : getAccessToken()
            // Session toujours là : le renouvellement n'a pas pu joindre le
            // serveur (redémarrage, réseau) — ce n'est pas une expiration.
            ? "Le serveur est momentanément indisponible, veuillez réessayer."
            : "Votre session a expiré — veuillez vous reconnecter pour continuer."
        : extractErrorMessage(data, "Une erreur est survenue, veuillez réessayer."),
      extractErrorCode(data),
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

/**
 * Lit un fichier privé (billet, facture, pièce justificative) : requête
 * authentifiée (Bearer, rafraîchissement de session compris). Les fichiers
 * privés ne sont plus accessibles par un lien direct (buckets privés).
 */
export async function apiFetchBlob(path: string, isRetry = false): Promise<Blob> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard.");
  }

  if (response.status === 401 && !isRetry && token) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetchBlob(path, true);
  }
  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Réponse sans corps JSON.
    }
    throw new ApiError(response.status, extractErrorMessage(data, "Fichier inaccessible, veuillez réessayer."));
  }
  return response.blob();
}

/** Télécharge un fichier privé et l'enregistre localement. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(await apiFetchBlob(path));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
