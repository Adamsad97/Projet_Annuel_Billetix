// Client des préférences de notification de l'acheteur (/users/buyer/notification-prefs).

import { apiGet, apiPatch } from "./client";

export function getNotificationPrefs(): Promise<Record<string, boolean>> {
  return apiGet<Record<string, boolean>>("/users/buyer/notification-prefs");
}

export function updateNotificationPrefs(
  preferences: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  return apiPatch<Record<string, boolean>>("/users/buyer/notification-prefs", { preferences });
}
