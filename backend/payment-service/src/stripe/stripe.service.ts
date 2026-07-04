import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(data: {
    amount_cents: number;
    currency: string;
    order_id: string;
    buyer_email: string;
  }): Promise<{ client_secret: string; payment_intent_id: string }> {
    const intent = await this.stripe.paymentIntents.create({
      amount: data.amount_cents,
      currency: data.currency,
      metadata: { order_id: data.order_id },
      receipt_email: data.buyer_email,
    });
    return { client_secret: intent.client_secret, payment_intent_id: intent.id };
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }

  async createRefund(paymentIntentId: string, amount_cents?: number): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount_cents ? { amount: amount_cents } : {}),
    });
  }

  async createTransfer(data: {
    amount_cents: number;
    stripe_account_id: string;
    order_id: string;
  }): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create({
      amount: data.amount_cents,
      currency: 'eur',
      destination: data.stripe_account_id,
      metadata: { order_id: data.order_id },
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }
}
