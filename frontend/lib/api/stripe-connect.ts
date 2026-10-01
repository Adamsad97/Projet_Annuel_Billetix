// Client du compte de reversement Stripe Connect ; les coordonnées bancaires sont saisies chez Stripe.

import { apiGet, apiPost } from "./client";

export interface ApiConnectStatus {
  /** Un compte Stripe a été créé pour l'organisateur. */
  connected: boolean;
  /** Prêt à recevoir les reversements. */
  onboarded: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  /** Informations encore demandées par Stripe. */
  requirements_due: number;
  bank: { bank_name: string | null; last4: string } | null;
}

export function getConnectStatus(): Promise<ApiConnectStatus> {
  return apiGet<ApiConnectStatus>("/users/organizer/stripe-connect/status");
}

/** Lien vers le formulaire Stripe (création du compte au premier appel). */
export function startConnectOnboarding(): Promise<{ url: string }> {
  return apiPost<{ url: string }>("/users/organizer/stripe-connect/onboard");
}

/** Lien vers l'espace Stripe de l'organisateur (compte bancaire, virements). */
export function openConnectDashboard(): Promise<{ url: string }> {
  return apiPost<{ url: string }>("/users/organizer/stripe-connect/dashboard");
}
