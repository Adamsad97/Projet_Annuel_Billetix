// Client de /users/me/export (api-gateway) : toutes les données du compte, RGPD articles 15 et 20.

import { apiDownload } from "./client";

/** Télécharge le fichier JSON des données personnelles ; une connexion récente est exigée (code REAUTH_REQUIRED sinon). */
export function downloadMyPersonalData(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  return apiDownload("/users/me/export", `billetix-mes-donnees-${today}.json`);
}
