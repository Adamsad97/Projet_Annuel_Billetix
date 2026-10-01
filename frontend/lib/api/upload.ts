// Client de POST /upload/* en multipart (hors lib/api/client.ts, qui envoie du JSON).

import { getApiBaseUrl } from "./base-url";
import { isPreviewActive, PREVIEW_READ_ONLY_MESSAGE } from "@/lib/auth/preview";
import { getAccessToken } from "@/lib/auth/session";
import { ApiError, extractErrorMessage } from "./http-error";
import { refreshAccessToken } from "./client";
import { t } from "@/lib/i18n/translate";

const API_URL = getApiBaseUrl();

// Jeton expiré : rafraîchit la session en silence avant d'abandonner l'upload.
async function uploadFile(path: string, file: File, isRetry = false): Promise<{ url: string }> {
  const token = getAccessToken();
  if (isPreviewActive()) throw new ApiError(403, t(PREVIEW_READ_ONLY_MESSAGE), "PREVIEW_READ_ONLY");
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
    throw new ApiError(0, t("Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard."));
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
        ? t("Votre session a expiré — veuillez vous reconnecter pour continuer.")
        : extractErrorMessage(data, t("Le téléversement a échoué, veuillez réessayer.")),
    );
  }

  return data as { url: string };
}

export function uploadPoster(file: File): Promise<{ url: string }> {
  return uploadFile("/upload/poster", file);
}

/** Pièce justificative (KYC, but non lucratif) — stockée en privé. */
export function uploadDocument(file: File): Promise<{ url: string }> {
  return uploadFile("/upload/document", file);
}

/** Image publique de profil (avatar, logo d'organisateur). */
export function uploadAvatar(file: File): Promise<{ url: string }> {
  return uploadFile("/upload/avatar", file);
}
