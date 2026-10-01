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
  /** Confirmé côté frontend via Stripe.js, sans redirection. */
  clientSecret?: string;
}

export interface RefundResult {
  refundId: string;
}

/**
 * Contrat du prestataire de paiement acheteur (Stripe). La confirmation
 * passe par le webhook signé, hors de ce contrat.
 */
export interface PaymentProviderPort {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  refund(providerPaymentId: string, amountCents?: number): Promise<RefundResult>;
}
