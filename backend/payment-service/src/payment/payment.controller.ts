import { Inject, Controller } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PaypalProvider } from '../providers/paypal.provider';
import { WaveProvider } from '../providers/wave.provider';
import { StripeService } from '../stripe/stripe.service';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripe: StripeService,
    private readonly paypal: PaypalProvider,
    private readonly wave: WaveProvider,
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
    data: {
      organizer_id: string;
      email: string;
      existing_account_id: string | null;
      refresh_url: string;
      return_url: string;
    },
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

  @MessagePattern('payment.create_intent')
  createIntent(@Payload() data: { order_id: string; buyer_id: string; buyer_email: string }) {
    return this.paymentService.createIntent(data);
  }

  @MessagePattern('payment.confirm_webhook')
  async confirmFromWebhook(@Payload() data: { payload: string; signature: string }) {
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
      const account = event.data.object as {
        id: string;
        details_submitted: boolean;
        charges_enabled: boolean;
      };
      await firstValueFrom(
        this.userClient.send('user.set_stripe_connect_onboarded', {
          account_id: account.id,
          onboarded: account.details_submitted && account.charges_enabled,
        }),
      );
      return { received: true };
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
  async syncStripeStatus(@Payload() data: { order_id: string }) {
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

  @MessagePattern('payment.confirm_paypal_webhook')
  async confirmPaypalWebhook(
    @Payload() data: { payload: string; headers: Record<string, string> },
  ) {
    const verified = await this.paypal.verifyWebhookSignature(data.headers, data.payload);
    if (!verified) {
      throw new RpcException({ statusCode: 400, message: 'Signature webhook PayPal invalide' });
    }

    const event = JSON.parse(data.payload) as { event_type: string; resource: { id: string } };
    if (event.event_type !== 'CHECKOUT.ORDER.APPROVED') {
      return { received: true };
    }

    const payment = await this.paymentService.confirmPaypalOrderApproved(event.resource.id);
    if (!payment) return { received: true };

    return {
      received: true,
      order_id: payment.order_id,
      payment_intent_id: payment.provider_payment_id,
      already_processed: payment._wasAlreadyPaid,
      failed: payment.status === 'FAILED',
    };
  }

  /**
   * Orange Money notifie sur `notif_url` (pas de signature HMAC comme
   * Stripe/Wave) — authentifié via le `notif_token` émis à la création du
   * paiement, puis le statut réel est revérifié auprès d'Orange Money.
   */
  @MessagePattern('payment.confirm_orange_money_callback')
  async confirmOrangeMoneyCallback(
    @Payload() data: { pay_token: string; order_id: string; notif_token: string },
  ) {
    const payment = await this.paymentService.confirmOrangeMoneyCallback(
      data.pay_token,
      data.order_id,
      data.notif_token,
    );
    if (!payment) return { received: true };

    return {
      received: true,
      order_id: payment.order_id,
      payment_intent_id: payment.provider_payment_id,
      already_processed: payment._wasAlreadyPaid,
      failed: payment.status === 'FAILED',
    };
  }

  @MessagePattern('payment.confirm_wave_webhook')
  async confirmWaveWebhook(
    @Payload() data: { payload: string; signatureHeader: string },
  ) {
    const verified = this.wave.verifyWebhookSignature(data.signatureHeader, data.payload);
    if (!verified) {
      throw new RpcException({ statusCode: 400, message: 'Signature webhook Wave invalide' });
    }

    const event = JSON.parse(data.payload) as {
      type: string;
      data: { id: string; checkout_status: string };
    };
    if (event.type !== 'checkout.session.completed' || event.data.checkout_status !== 'complete') {
      return { received: true };
    }

    const payment = await this.paymentService.confirmWaveCheckoutCompleted(event.data.id);
    if (!payment) return { received: true };

    return {
      received: true,
      order_id: payment.order_id,
      payment_intent_id: payment.provider_payment_id,
      already_processed: payment._wasAlreadyPaid,
    };
  }

  @MessagePattern('payment.get_by_order')
  getByOrder(@Payload() data: { order_id: string }) {
    return this.paymentService.getByOrder(data.order_id);
  }

  @MessagePattern('payment.refund')
  refund(@Payload() data: { order_id: string; amount_cents?: number }) {
    return this.paymentService.refund(data.order_id, data.amount_cents);
  }
}
