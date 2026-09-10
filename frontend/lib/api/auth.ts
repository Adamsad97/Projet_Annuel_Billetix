// Client pour les endpoints /auth de l'api-gateway (backend/api-gateway/src/auth).
// Câblage réel — plus de données mock pour ces deux flux.

import { ApiError, extractErrorMessage } from "./http-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Bug corrigé : "AGENT" manquait de ce type alors que le rôle existe bien
// côté backend (agents de contrôle promus depuis un compte BUYER) — un
// agent connecté avait un `user.role` hors du type déclaré.
export type UserRole = "BUYER" | "ORGANIZER" | "ADMIN" | "AGENT";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_email_verified: boolean;
  two_factor_enabled: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "BUYER" | "ORGANIZER";
}

export interface LoginPayload {
  email: string;
  password: string;
  two_factor_code?: string;
}

export type LoginResult =
  | AuthSession
  | { requires_2fa: true; two_factor_method: string };

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { method: "GET" });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.",
    );
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
      extractErrorMessage(data, "Une erreur est survenue, réessaie."),
    );
  }

  return data as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.",
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON (ex: 204) — pas une erreur en soi.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractErrorMessage(data, "Une erreur est survenue, réessaie."),
    );
  }

  return data as T;
}

export function registerUser(payload: RegisterPayload): Promise<AuthSession> {
  return postJson<AuthSession>("/auth/register", payload);
}

export function loginUser(payload: LoginPayload): Promise<LoginResult> {
  return postJson<LoginResult>("/auth/login", payload);
}

export function isAuthSession(result: LoginResult): result is AuthSession {
  return "access_token" in result;
}

export function requestPasswordReset(email: string): Promise<{ success?: boolean }> {
  return postJson("/auth/forgot-password", { email });
}

export interface RefreshResult {
  access_token: string;
  refresh_token: string;
}

export function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  return postJson<RefreshResult>("/auth/refresh", { refresh_token: refreshToken });
}

export function resetPassword(token: string, newPassword: string): Promise<{ success?: boolean }> {
  return postJson("/auth/reset-password", { token, new_password: newPassword });
}

export function verifyEmail(token: string): Promise<{ success?: boolean }> {
  return getJson(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
