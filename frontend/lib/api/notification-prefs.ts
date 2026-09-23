// Client pour /users/buyer/notification-prefs (api-gateway). Câblage réel —
// niveau 1 seulement (stockage/lecture) : les préférences persistent, mais
// ne bloquent pas encore l'envoi des notifications correspondantes côté
// backend (voir lib/mock/notification-prefs.ts pour le détail des ids).

import { apiGet, apiPatch } from "./client";

export function getNotificationPrefs(): Promise<Record<string, boolean>> {
  return apiGet<Record<string, boolean>>("/users/buyer/notification-prefs");
}

export function updateNotificationPrefs(
  preferences: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  return apiPatch<Record<string, boolean>>("/users/buyer/notification-prefs", { preferences });
}
