import { Injectable } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProviderPort,
  RefundResult,
} from './payment-provider.interface';

/**
 * Adaptateur fin autour de StripeService (qui gère aussi les virements aux
 * organisateurs, hors périmètre de ce contrat commun) pour le rendre
 * interchangeable avec les autres prestataires de paiement acheteur.
 */
@Injectable()
export class StripePaymentProvider implements PaymentProviderPort {
  constructor(private readonly stripe: StripeService) {}

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const { client_secret, payment_intent_id } = await this.stripe.createPaymentIntent({
      amount_cents: params.amountCents,
      currency: params.currency,
      order_id: params.orderId,
      buyer_email: params.buyerEmail,
    });
    return { providerPaymentId: payment_intent_id, clientSecret: client_secret };
  }

  async refund(providerPaymentId: string, amountCents?: number): Promise<RefundResult> {
    const refund = await this.stripe.createRefund(providerPaymentId, amountCents);
    return { refundId: refund.id };
  }
}
