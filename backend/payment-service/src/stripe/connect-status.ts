import type Stripe from 'stripe';

/** État d'un compte Stripe Connect, tel que présenté à l'organisateur. */
export interface ConnectAccountStatus {
  /** Formulaire Stripe complété. */
  details_submitted: boolean;
  /** Stripe peut verser sur le compte bancaire de l'organisateur. */
  payouts_enabled: boolean;
  /** Prêt à recevoir les reversements de la plateforme. */
  onboarded: boolean;
  /** Nombre d'informations encore demandées par Stripe. */
  requirements_due: number;
  /** Compte bancaire déclaré à Stripe (jamais le numéro complet). */
  bank: { bank_name: string | null; last4: string } | null;
}

/** Compte prêt : formulaire complété, virements vers la banque ouverts et capacité « transferts » active. */
export function connectAccountStatus(account: Stripe.Account): ConnectAccountStatus {
  const details_submitted = account.details_submitted === true;
  const payouts_enabled = account.payouts_enabled === true;
  const transfersActive = account.capabilities?.transfers === 'active';
  const bankAccount = account.external_accounts?.data?.find(
    (external): external is Stripe.BankAccount => external.object === 'bank_account',
  );
  return {
    details_submitted,
    payouts_enabled,
    onboarded: details_submitted && payouts_enabled && transfersActive,
    requirements_due: account.requirements?.currently_due?.length ?? 0,
    bank: bankAccount ? { bank_name: bankAccount.bank_name ?? null, last4: bankAccount.last4 } : null,
  };
}
