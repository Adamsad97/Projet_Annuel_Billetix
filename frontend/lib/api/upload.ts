// Client pour POST /upload/* (backend/api-gateway/src/upload/upload.controller.ts).
// Multipart — ne peut pas passer par lib/api/client.ts (qui JSON.stringify
// systématiquement le corps de la requête).

import { getAccessToken } from "@/lib/auth/session";
import { ApiError, extractErrorMessage } from "./http-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function uploadFile(path: string, file: File): Promise<{ url: string }> {
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
    throw new ApiError(0, "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON.
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(data, "Le téléversement a échoué, réessaie."));
  }

  return data as { url: string };
}

export function uploadPoster(file: File): Promise<{ url: string }> {
  return uploadFile("/upload/poster", file);
}
