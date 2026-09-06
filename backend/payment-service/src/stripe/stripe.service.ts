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
      // Active automatiquement toutes les méthodes de paiement configurées
      // sur le compte Stripe (carte, Apple Pay, Google Pay...) — Apple Pay
      // et Google Pay ne sont pas des prestataires distincts, ce sont des
      // méthodes de paiement au sein du même PaymentIntent Stripe, choisies
      // par le navigateur/l'appareil de l'acheteur côté frontend.
      automatic_payment_methods: { enabled: true },
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

  /**
   * Bug corrigé (CDC §7) : aucun flux d'onboarding Stripe Connect n'existait
   * nulle part — stripe_connect_account_id/onboarded n'étaient jamais
   * renseignés, donc PayoutSchedulerService.processDuePayouts() ignorait
   * systématiquement tous les reversements (aucun organisateur ne pouvait
   * jamais être payé). Compte Express : le minimum de friction pour un
   * organisateur individuel (Stripe héberge le formulaire KYC bancaire).
   */
  async createConnectAccount(email: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true } },
    });
    return account.id;
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return link.url;
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }
}
