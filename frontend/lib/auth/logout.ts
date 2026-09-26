import { revokeRefreshToken } from "@/lib/api/auth";
import { endSession, getRefreshToken, type SessionEndReason } from "@/lib/auth/session";

/**
 * Déconnexion complète. Bug corrigé : le bouton « Déconnexion » effaçait
 * seulement le stockage du navigateur — le refresh token restait valable
 * côté serveur (30 jours). Révocation best-effort : la session locale est
 * fermée même si le serveur est injoignable.
 */
export async function logout(reason: SessionEndReason = "manuelle"): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await revokeRefreshToken(refreshToken).catch(() => undefined);
  }
  endSession(reason);
}
