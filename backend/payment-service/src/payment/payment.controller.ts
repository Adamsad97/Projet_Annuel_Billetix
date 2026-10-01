import { Inject, Controller } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { StripeService } from '../stripe/stripe.service';
import { PaymentService } from './payment.service';
import { ChargebackPayload, ConnectAccountPayload, ConnectOnboardingPayload, CreateIntentPayload, OrderIdPayload, RefundPayload, StripeWebhookPayload } from '../common/payloads';
import type Stripe from 'stripe';
import { connectAccountStatus } from '../stripe/connect-status';

// Motifs de contestation Stripe → motifs de litige de la plateforme.
const STRIPE_DISPUTE_REASONS: Record<string, string> = {
  fraudulent: 'FRAUDULENT',
  duplicate: 'DUPLICATE',
  product_not_received: 'PRODUCT_NOT_RECEIVED',
  product_unacceptable: 'PRODUCT_UNACCEPTABLE',
  subscription_canceled: 'SUBSCRIPTION_CANCELED',
};

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripe: StripeService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  /**
   * Bug corrigé (CDC §7) : aucun flux d'onboarding Stripe Connect n'existait
   * — crée le compte Connect au premier appel (jamais recréé ensuite,
   * réutilise l'existant), puis génère un lien d'onboarding à chaque appel
   * (les liens expirent après quelques minutes côté Stripe).
   */
  @MessagePattern('payment.create_connect_onboarding_link')
  async createConnectOnboardingLink(
    @Payload()
    data: ConnectOnboardingPayload,
  ) {
    let accountId = data.existing_account_id;
    if (!accountId) {
      accountId = await this.stripe.createConnectAccount(data.email);
      await firstValueFrom(
        this.userClient.send('user.set_stripe_connect_account', {
          user_id: data.organizer_id,
          account_id: accountId,
        }),
      );
    }

    const url = await this.stripe.createAccountLink(
      accountId,
      data.refresh_url,
      data.return_url,
    );
    return { account_id: accountId, url };
  }

  /**
   * État du compte Connect lu directement chez Stripe : ne dépend pas du
   * webhook account.updated, qui peut ne jamais arriver (poste de
   * développement sans tunnel, webhook mal configuré en production).
   */
  @MessagePattern('payment.get_connect_status')
  async getConnectStatus(@Payload() data: ConnectAccountPayload) {
    return connectAccountStatus(await this.stripe.retrieveAccount(data.account_id));
  }

  @MessagePattern('payment.create_connect_login_link')
  async createConnectLoginLink(@Payload() data: ConnectAccountPayload) {
    return { url: await this.stripe.createLoginLink(data.account_id) };
  }

  @MessagePattern('payment.create_intent')
  createIntent(@Payload() data: CreateIntentPayload) {
    return this.paymentService.createIntent(data);
  }

  @MessagePattern('payment.confirm_webhook')
  async confirmFromWebhook(@Payload() data: StripeWebhookPayload) {
    let event: ReturnType<typeof this.stripe.constructWebhookEvent>;
    try {
      event = this.stripe.constructWebhookEvent(
        Buffer.from(data.payload, 'utf8'),
        data.signature,
      );
    } catch {
      throw new RpcException({ statusCode: 400, message: 'Signature webhook invalide' });
    }

    // Suit la progression de l'onboarding Connect d'un organisateur —
    // Stripe renvoie cet événement à chaque changement d'état du compte
    // connecté (formulaire complété, vérification d'identité, etc.).
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      await firstValueFrom(
        this.userClient.send('user.set_stripe_connect_onboarded', {
          account_id: account.id,
          onboarded: connectAccountStatus(account).onboarded,
        }),
      );
      return { received: true };
    }

    // Contestation bancaire (chargeback) : la passerelle ouvre ou clôt le
    // litige correspondant (elle seule connaît l'acheteur de la commande).
    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
      const dispute = event.data.object as Stripe.Dispute;
      const intentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
      const payment = intentId ? await this.paymentService.findByProviderPaymentId(intentId) : null;
      return {
        received: true,
        dispute: {
          event: event.type === 'charge.dispute.created' ? 'created' : 'closed',
          stripe_dispute_id: dispute.id,
          order_id: payment?.order_id ?? null,
          payment_id: payment?.id ?? null,
          reason: STRIPE_DISPUTE_REASONS[dispute.reason] ?? 'GENERAL',
          won: dispute.status === 'won',
          amount: dispute.amount / 100,
        },
      };
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as {
        id: string;
        last_payment_error?: { message?: string };
      };
      const reason = intent.last_payment_error?.message ?? 'Paiement refusé';
      const payment = await this.paymentService.markFailed(intent.id, reason);

      return {
        received: true,
        failed: true,
        order_id: payment?.order_id,
        failure_reason: reason,
      };
    }

    if (event.type !== 'payment_intent.succeeded') {
      return { received: true };
    }

    const intent = event.data.object as { id: string };
    const payment = await this.paymentService.confirmFromWebhook(intent.id);

    // already_processed : le paiement était déjà PAID → ne pas re-déclencher la génération de billets
    return {
      received: true,
      order_id: payment.order_id,
      payment_intent_id: payment.provider_payment_id,
      already_processed: payment._wasAlreadyPaid,
    };
  }

  /**
   * Bug corrigé : la confirmation d'un paiement Stripe reposait uniquement
   * sur le webhook. S'il n'arrive pas (Stripe ne peut pas joindre un
   * serveur local, panne réseau, webhook mal configuré), un paiement bien
   * encaissé restait « en attente » : ni billets ni email. Vérification de
   * secours : on demande à Stripe l'état réel du PaymentIntent, puis même
   * traitement (idempotent) que le webhook.
   */
  @MessagePattern('payment.sync_stripe_status')
  async syncStripeStatus(@Payload() data: OrderIdPayload) {
    const payment = await this.paymentService.findLatestStripeByOrder(data.order_id);
    if (!payment?.provider_payment_id) {
      return { status: 'unknown' as const };
    }

    const intent = await this.stripe.retrievePaymentIntent(payment.provider_payment_id);

    if (intent.status === 'succeeded') {
      const confirmed = await this.paymentService.confirmFromWebhook(intent.id);
      return {
        status: 'paid' as const,
        order_id: confirmed.order_id,
        payment_intent_id: confirmed.provider_payment_id,
        already_processed: confirmed._wasAlreadyPaid,
      };
    }

    if (intent.status === 'requires_payment_method' && intent.last_payment_error) {
      const reason = intent.last_payment_error.message ?? 'Paiement refusé';
      await this.paymentService.markFailed(intent.id, reason);
      return { status: 'failed' as const, order_id: payment.order_id, failure_reason: reason };
    }

    return { status: 'pending' as const };
  }

  @MessagePattern('payment.record_chargeback')
  recordChargeback(@Payload() data: ChargebackPayload) {
    return this.paymentService.recordChargeback(data.order_id, data.amount);
  }

  @MessagePattern('payment.get_by_order')
  getByOrder(@Payload() data: OrderIdPayload) {
    return this.paymentService.getByOrder(data.order_id);
  }

  @MessagePattern('payment.refund')
  refund(@Payload() data: RefundPayload) {
    return this.paymentService.refund(data.order_id, data.amount_cents);
  }
}
