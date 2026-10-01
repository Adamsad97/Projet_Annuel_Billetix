// Client pour les endpoints /auth de l'api-gateway (backend/api-gateway/src/auth).
// Câblage réel — plus de données mock pour ces deux flux.

import { getApiBaseUrl } from "./base-url";
import { ApiError, extractErrorCode, extractErrorMessage } from "./http-error";
import { t } from "@/lib/i18n/translate";

const API_URL = getApiBaseUrl();

// Rôles du backend, AGENT et SUPER_ADMIN compris.
export type UserRole = "BUYER" | "ORGANIZER" | "ADMIN" | "AGENT" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  /** "YYYY-MM-DD" — null pour les comptes Google/Facebook. */
  birth_date?: string | null;
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
  /** "YYYY-MM-DD" — obligatoire : inscription refusée sous l'âge minimum. */
  birth_date: string;
  role: "BUYER" | "ORGANIZER";
}

// L'inscription ne renvoie pas de jetons : l'accès passe par login() après vérification de l'email.
export interface RegisterResult {
  email_verification_required: true;
  user: AuthUser;
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
      t("Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard."),
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
      extractErrorMessage(data, t("Une erreur est survenue, veuillez réessayer.")),
      extractErrorCode(data),
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
      t("Impossible de contacter le serveur — vérifiez votre connexion ou réessayez plus tard."),
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
      extractErrorMessage(data, t("Une erreur est survenue, veuillez réessayer.")),
      extractErrorCode(data),
    );
  }

  return data as T;
}

export function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  return postJson<RegisterResult>("/auth/register", payload);
}

export function resendVerificationEmail(email: string): Promise<{ success: boolean }> {
  return postJson("/auth/resend-verification-email", { email });
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

/** Révoque le refresh token côté serveur (déconnexion). */
export function revokeRefreshToken(refreshToken: string): Promise<{ success: boolean }> {
  return postJson("/auth/logout", { refresh_token: refreshToken });
}

export function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  return postJson<RefreshResult>("/auth/refresh", { refresh_token: refreshToken });
}

/** Durées de session : inactivité et durée maximale (platform_settings). */
export function getSessionPolicy(): Promise<{ idle_timeout_minutes: number; max_duration_hours: number }> {
  return getJson("/auth/session-policy");
}

/** Règles d'inscription en vigueur (paramétrables par l'admin, platform_settings). */
export function getRegistrationPolicy(): Promise<{ password_min_length: number; minimum_age: number }> {
  return getJson("/auth/registration-policy");
}

export function resetPassword(token: string, newPassword: string): Promise<{ success?: boolean }> {
  return postJson("/auth/reset-password", { token, new_password: newPassword });
}

// ─── OAuth Google/Facebook : échange du code, puis date de naissance et/ou 2FA si nécessaire ───

export interface OAuthPending2fa {
  requires_2fa: true;
  two_factor_method: string;
  pending_token: string;
}

export interface OAuthPendingBirthDate {
  requires_birth_date: true;
  pending_token: string;
  first_name: string;
}

export type OAuthExchangeResult = AuthSession | OAuthPending2fa | OAuthPendingBirthDate;

export function exchangeOAuthCode(code: string): Promise<OAuthExchangeResult> {
  return postJson<OAuthExchangeResult>("/auth/oauth/exchange", { code });
}

export function verifyOAuth2fa(pendingToken: string, code: string): Promise<AuthSession> {
  return postJson<AuthSession>("/auth/oauth/verify-2fa", { pending_token: pendingToken, code });
}

export function completeOAuthBirthDate(
  pendingToken: string,
  birthDate: string,
): Promise<AuthSession | OAuthPending2fa> {
  return postJson("/auth/oauth/complete-birth-date", {
    pending_token: pendingToken,
    birth_date: birthDate,
  });
}

export function isOAuthPending2fa(result: OAuthExchangeResult): result is OAuthPending2fa {
  return "requires_2fa" in result;
}

export function isOAuthPendingBirthDate(result: OAuthExchangeResult): result is OAuthPendingBirthDate {
  return "requires_birth_date" in result;
}

export function verifyEmail(token: string): Promise<{ success?: boolean }> {
  return getJson(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
