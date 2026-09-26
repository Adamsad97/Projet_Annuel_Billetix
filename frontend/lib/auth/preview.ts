// Mode aperçu du back-office : un admin « prend » un rôle (acheteur,
// organisateur, agent) pour voir la plateforme comme lui — navigation,
// pages, écrans — en lecture seule. Purement côté interface : le compte
// reste administrateur pour le serveur, qui refuse toujours à un admin
// d'acheter, de créer un événement ou de scanner. En plus, toute requête
// de modification est bloquée ici avant de partir (lib/api/client.ts).
// Propre à l'onglet (sessionStorage) et effacé à la fin de la session.

import type { AuthUser, UserRole } from "@/lib/api/auth";
import { getStoredUser, PREVIEW_ROLE_KEY } from "@/lib/auth/session";

export type PreviewRole = "BUYER" | "ORGANIZER" | "AGENT";

export const PREVIEW_ROLES: Array<{ role: PreviewRole; label: string; home: string }> = [
  { role: "BUYER", label: "Acheteur", home: "/" },
  { role: "ORGANIZER", label: "Organisateur", home: "/dashboard" },
  { role: "AGENT", label: "Agent de contrôle", home: "/scan" },
];

export const PREVIEW_CHANGED_EVENT = "billetix:preview-changed";
export const PREVIEW_READ_ONLY_MESSAGE = "Mode aperçu : cette action est désactivée.";

export function isAdminRole(role: UserRole | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Rôle prévisualisé, uniquement pour un compte réellement administrateur. */
export function getPreviewRole(): PreviewRole | null {
  if (typeof window === "undefined") return null;
  if (!isAdminRole(getStoredUser()?.role)) return null;
  const role = window.sessionStorage.getItem(PREVIEW_ROLE_KEY);
  return PREVIEW_ROLES.some((option) => option.role === role) ? (role as PreviewRole) : null;
}

export function isPreviewActive(): boolean {
  return getPreviewRole() !== null;
}

export function previewLabel(role: PreviewRole): string {
  return PREVIEW_ROLES.find((option) => option.role === role)?.label ?? role;
}

export function previewHome(role: PreviewRole): string {
  return PREVIEW_ROLES.find((option) => option.role === role)?.home ?? "/";
}

export function startPreview(role: PreviewRole): void {
  window.sessionStorage.setItem(PREVIEW_ROLE_KEY, role);
  window.dispatchEvent(new CustomEvent(PREVIEW_CHANGED_EVENT));
}

export function stopPreview(): void {
  window.sessionStorage.removeItem(PREVIEW_ROLE_KEY);
  window.dispatchEvent(new CustomEvent(PREVIEW_CHANGED_EVENT));
}

/** Rôle à utiliser pour l'interface : le rôle prévisualisé, sinon le vrai. */
export function effectiveRole(user: AuthUser | null | undefined): UserRole | undefined {
  if (!user) return undefined;
  return (isAdminRole(user.role) ? getPreviewRole() : null) ?? user.role;
}
