// Client des endpoints /auth/2fa, authentifié via lib/api/client.

import { apiDelete, apiGet, apiPost } from "./client";

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorConfirmResult {
  success: boolean;
  backup_codes: string[];
}

export function get2faStatus(): Promise<boolean> {
  return apiGet<boolean>("/auth/2fa/status");
}

export function setup2fa(): Promise<TwoFactorSetup> {
  return apiPost<TwoFactorSetup>("/auth/2fa/setup");
}

export function confirm2fa(code: string): Promise<TwoFactorConfirmResult> {
  return apiPost<TwoFactorConfirmResult>("/auth/2fa/confirm", { code });
}

export function disable2fa(code: string): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>("/auth/2fa", { code });
}
