// Client pour /auth/change-password (api-gateway) — authentifié, via
// lib/api/client (Bearer + rafraîchissement transparent). Fichier séparé de
// lib/api/auth.ts (flux pré-connexion) pour éviter un import circulaire :
// lib/api/client importe déjà lib/api/auth (refreshTokens).

import { apiPost } from "./client";

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
