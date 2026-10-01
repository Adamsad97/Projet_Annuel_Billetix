// Client de /auth/change-password, séparé de lib/api/auth.ts pour éviter un import circulaire.

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
