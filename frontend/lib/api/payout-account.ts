// Client pour le compte de reversement de l'organisateur : IBAN (virement
// de la plateforme, par défaut) ou Stripe Connect (facultatif).

import { apiGet, apiPatch } from "./client";

export type PayoutMethod = "BANK_TRANSFER" | "STRIPE";

export interface ApiPayoutAccount {
  payout_method: PayoutMethod;
  has_iban: boolean;
  /** « FR76 •••• •••• 1234 » : l'IBAN complet n'est jamais renvoyé. */
  iban_masked: string | null;
  bank_owner_name: string | null;
  iban_updated_at: string | null;
  stripe_connect_onboarded: boolean;
  kyc_status: string;
  /** Compte Google/Facebook sans mot de passe : une connexion récente suffit. */
  has_password: boolean;
  iban_change_payout_hold_hours: number;
  /** Compte sans mot de passe : délai après connexion pour modifier l'IBAN. */
  sensitive_action_reauth_minutes: number;
  /** Reversements suspendus après un changement d'IBAN, jusqu'à cette date. */
  payouts_held_until: string | null;
}

export function getPayoutAccount(): Promise<ApiPayoutAccount> {
  return apiGet<ApiPayoutAccount>("/users/organizer/payout-account");
}

export function updateIban(body: {
  iban: string;
  bank_owner_name: string;
  current_password?: string;
}): Promise<{ changed: boolean; iban_masked: string; payouts_held_until: string | null }> {
  return apiPatch("/users/organizer/iban", body);
}

export function setPayoutMethod(payout_method: PayoutMethod): Promise<ApiPayoutAccount> {
  return apiPatch<ApiPayoutAccount>("/users/organizer/payout-method", { payout_method });
}
