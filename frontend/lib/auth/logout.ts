import { revokeRefreshToken } from "@/lib/api/auth";
import { endSession, getRefreshToken, type SessionEndReason } from "@/lib/auth/session";

/** Déconnexion complète : révoque aussi le refresh token côté serveur (best-effort). */
export async function logout(reason: SessionEndReason = "manuelle"): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await revokeRefreshToken(refreshToken).catch(() => undefined);
  }
  endSession(reason);
}
