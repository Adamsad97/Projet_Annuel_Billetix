export interface CreatePaymentParams {
  amountCents: number;
  currency: string;
  orderId: string;
  buyerEmail: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  /** Stripe uniquement : confirmé côté frontend via Stripe.js, pas de redirection. */
  clientSecret?: string;
  /** PayPal/Orange Money/Wave : l'acheteur doit être redirigé vers cette URL pour approuver le paiement. */
  redirectUrl?: string;
  /** Orange Money uniquement : jeton à revérifier lors du callback de notification. */
  notifToken?: string;
}

export interface RefundResult {
  refundId: string;
}

/**
 * Contrat commun à tous les prestataires de paiement (Stripe, PayPal,
 * Orange Money, Wave). Chaque prestataire a son propre mécanisme de
 * confirmation (webhook signé, callback avec jeton, capture explicite) —
 * volontairement hors de ce contrat, géré individuellement par
 * PaymentService selon le prestataire concerné.
 */
export interface PaymentProviderPort {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  refund(providerPaymentId: string, amountCents?: number): Promise<RefundResult>;
}
