// Client pour POST /upload/* (backend/api-gateway/src/upload/upload.controller.ts).
// Multipart — ne peut pas passer par lib/api/client.ts (qui JSON.stringify
// systématiquement le corps de la requête).

import { getApiBaseUrl } from "./base-url";
import { getAccessToken } from "@/lib/auth/session";
import { ApiError, extractErrorMessage } from "./http-error";
import { refreshAccessToken } from "./client";

const API_URL = getApiBaseUrl();

// Bug corrigé : contrairement à lib/api/client.ts (request()), cet appel
// n'essayait jamais de rafraîchir un access token expiré avant d'abandonner
// — un upload (affiche d'événement, document KYC...) tombant pile après
// l'expiration du token (courte durée, 15 min) affichait le message brut du
// guard JWT ("Token invalide ou expiré") au lieu de rafraîchir la session en
// silence comme partout ailleurs dans l'app.
async function uploadFile(path: string, file: File, isRetry = false): Promise<{ url: string }> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard.");
  }

  if (response.status === 401 && !isRetry && token) {
    const newToken = await refreshAccessToken();
    if (newToken) return uploadFile(path, file, true);
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
        ? "Votre session a expiré — veuillez vous reconnecter pour continuer."
        : extractErrorMessage(data, "Le téléversement a échoué, veuillez réessayer."),
    );
  }

  return data as { url: string };
}

export function uploadPoster(file: File): Promise<{ url: string }> {
  return uploadFile("/upload/poster", file);
}
