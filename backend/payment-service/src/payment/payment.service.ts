import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { OrangeMoneyProvider } from '../providers/orange-money.provider';
import { PaymentProviderPort } from '../providers/payment-provider.interface';
import { PaypalProvider } from '../providers/paypal.provider';
import { StripePaymentProvider } from '../providers/stripe.provider';
import { WaveProvider } from '../providers/wave.provider';
import { PayoutService } from '../payout/payout.service';
import { Payment, PaymentProvider, PaymentStatus } from './payment.entity';

interface ResolvedProvider {
  provider: PaymentProvider;
  implementation: PaymentProviderPort;
  currency: string;
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly paypalProvider: PaypalProvider,
    private readonly orangeMoneyProvider: OrangeMoneyProvider,
    private readonly waveProvider: WaveProvider,
    private readonly payoutService: PayoutService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Résout le prestataire réel à partir de la méthode de paiement choisie
   * par l'acheteur (order.payment_method). Apple Pay/Google Pay ne sont pas
   * des prestataires à part — ce sont des méthodes de paiement au sein du
   * même PaymentIntent Stripe (choisies par le navigateur/l'appareil).
   */
  private resolveProvider(paymentMethod: string): ResolvedProvider {
    switch (paymentMethod) {
      case 'STRIPE':
      case 'APPLE_PAY':
      case 'GOOGLE_PAY':
        return { provider: PaymentProvider.STRIPE, implementation: this.stripeProvider, currency: 'eur' };
      case 'PAYPAL':
        return { provider: PaymentProvider.PAYPAL, implementation: this.paypalProvider, currency: 'eur' };
      case 'ORANGE_MONEY':
        return {
          provider: PaymentProvider.ORANGE_MONEY,
          implementation: this.orangeMoneyProvider,
          currency: this.config.get<string>('ORANGE_MONEY_CURRENCY', 'OUV'),
        };
      case 'WAVE':
        return {
          provider: PaymentProvider.WAVE,
          implementation: this.waveProvider,
          currency: this.config.get<string>('WAVE_CURRENCY', 'XOF'),
        };
      default:
        throw new RpcException({ statusCode: 400, message: `Moyen de paiement non supporté : ${paymentMethod}` });
    }
  }

  private providerImplementationFor(provider: PaymentProvider): PaymentProviderPort {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.stripeProvider;
      case PaymentProvider.PAYPAL:
        return this.paypalProvider;
      case PaymentProvider.ORANGE_MONEY:
        return this.orangeMoneyProvider;
      case PaymentProvider.WAVE:
        return this.waveProvider;
    }
  }

  async createIntent(data: {
    order_id: string;
    buyer_id: string;
    buyer_email: string;
  }): Promise<{
    payment_id: string;
    provider: PaymentProvider;
    client_secret?: string;
    redirect_url?: string;
  }> {
    const existing = await this.repo.findOne({ where: { order_id: data.order_id } });
    if (existing && existing.status === PaymentStatus.PAID) {
      throw new RpcException({ statusCode: 409, message: 'Commande déjà payée' });
    }

    // Le montant à payer n'est jamais fourni par le client — toujours relu
    // depuis order-service (source de vérité) pour empêcher un acheteur de
    // payer le montant de son choix pour n'importe quelle commande. Le
    // moyen de paiement, lui, vient bien du choix de l'acheteur au moment
    // de la commande (order.payment_method) — ce n'est pas une donnée
    // sensible, juste une préférence de canal de paiement.
    const { order } = await firstValueFrom(
      this.orderClient.send('order.get', { id: data.order_id }),
    ) as { order: { buyer_id: string; total_amount_ttc: number; payment_method: string } };

    if (order.buyer_id !== data.buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    // Défense en profondeur : une commande entièrement gratuite ne doit
    // jamais passer par un prestataire de paiement (cf. tunnel gratuit CDC
    // §4.1 — aucun moyen de paiement sollicité). Le flux normal
    // (api-gateway) ne crée pas d'intent pour ces commandes ; ce garde-fou
    // empêche seulement un appel direct erroné/malveillant à ce endpoint.
    if (Number(order.total_amount_ttc) === 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Commande gratuite : aucun paiement requis',
      });
    }

    const amount_ttc = Number(order.total_amount_ttc);
    const amount_cents = Math.round(amount_ttc * 100);
    const { provider, implementation, currency } = this.resolveProvider(order.payment_method);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const result = await implementation.createPayment({
      amountCents: amount_cents,
      currency,
      orderId: data.order_id,
      buyerEmail: data.buyer_email,
      returnUrl: `${frontendUrl}/orders/${data.order_id}/payment-return`,
      cancelUrl: `${frontendUrl}/orders/${data.order_id}/payment-cancel`,
    });

    const payment = existing ?? this.repo.create({ order_id: data.order_id, amount: amount_ttc });
    payment.amount = amount_ttc;
    payment.currency = currency;
    payment.provider = provider;
    payment.provider_payment_id = result.providerPaymentId;
    payment.provider_client_secret = result.clientSecret ?? null;
    payment.provider_redirect_url = result.redirectUrl ?? null;
    payment.provider_notif_token = result.notifToken ?? null;
    await this.repo.save(payment);

    return {
      payment_id: payment.id,
      provider,
      client_secret: result.clientSecret,
      redirect_url: result.redirectUrl,
    };
  }

  /**
   * Transition atomique vers PAID, uniquement depuis un statut non-payé.
   * Les webhooks sont parfois redélivrés (timeout, retry) — sans cette
   * garde au niveau SQL, deux appels quasi simultanés liraient tous deux
   * `status != PAID` avant que l'un des deux ne sauvegarde, provoquant une
   * double génération de billets et un double reversement. Commun à tous
   * les prestataires.
   */
  private async markPaidIdempotent(payment: Payment): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Payment)
      .set({ status: PaymentStatus.PAID })
      .where('id = :id', { id: payment.id })
      .andWhere('status != :paid', { paid: PaymentStatus.PAID })
      .execute();

    const wasAlreadyPaid = result.affected === 0;
    if (!wasAlreadyPaid) {
      payment.status = PaymentStatus.PAID;
    }
    return wasAlreadyPaid;
  }

  async confirmFromWebhook(paymentIntentId: string): Promise<Payment & { _wasAlreadyPaid: boolean }> {
    const payment = await this.repo.findOne({ where: { provider_payment_id: paymentIntentId } });
    if (!payment) {
      throw new RpcException({ statusCode: 404, message: 'Paiement introuvable' });
    }

    const wasAlreadyPaid = await this.markPaidIdempotent(payment);
    return Object.assign(payment, { _wasAlreadyPaid: wasAlreadyPaid });
  }

  /**
   * PayPal : le webhook `CHECKOUT.ORDER.APPROVED` déclenche la capture
   * effective des fonds côté serveur (jamais côté client) — l'ID de
   * commande PayPal est remplacé par l'ID de capture réel, seul utilisable
   * ensuite pour un remboursement.
   */
  async confirmPaypalOrderApproved(
    paypalOrderId: string,
  ): Promise<(Payment & { _wasAlreadyPaid: boolean }) | null> {
    const payment = await this.repo.findOne({
      where: { provider_payment_id: paypalOrderId, provider: PaymentProvider.PAYPAL },
    });
    if (!payment) return null;
    if (payment.status === PaymentStatus.PAID) {
      return Object.assign(payment, { _wasAlreadyPaid: true });
    }

    const { captureId, status } = await this.paypalProvider.captureOrder(paypalOrderId);
    if (status !== 'COMPLETED') {
      payment.status = PaymentStatus.FAILED;
      payment.failure_reason = `Capture PayPal : ${status}`;
      await this.repo.save(payment);
      return Object.assign(payment, { _wasAlreadyPaid: false });
    }

    payment.provider_payment_id = captureId;
    await this.repo.save(payment);

    const wasAlreadyPaid = await this.markPaidIdempotent(payment);
    return Object.assign(payment, { _wasAlreadyPaid: wasAlreadyPaid });
  }

  /**
   * Orange Money : le callback de notification n'est jamais fait confiance
   * seul — le jeton `notif_token` est revérifié, puis le statut réel de la
   * transaction est requêté auprès d'Orange Money avant de valider.
   */
  async confirmOrangeMoneyCallback(
    payToken: string,
    orderId: string,
    notifToken: string,
  ): Promise<(Payment & { _wasAlreadyPaid: boolean }) | null> {
    const payment = await this.repo.findOne({
      where: { provider_payment_id: payToken, provider: PaymentProvider.ORANGE_MONEY },
    });
    if (!payment) return null;
    if (payment.status === PaymentStatus.PAID) {
      return Object.assign(payment, { _wasAlreadyPaid: true });
    }
    if (payment.provider_notif_token !== notifToken) {
      throw new RpcException({ statusCode: 403, message: 'Jeton de notification Orange Money invalide' });
    }

    const status = await this.orangeMoneyProvider.getTransactionStatus(payToken, orderId);
    if (status !== 'SUCCESS') {
      payment.status = PaymentStatus.FAILED;
      payment.failure_reason = `Statut Orange Money : ${status}`;
      await this.repo.save(payment);
      return Object.assign(payment, { _wasAlreadyPaid: false });
    }

    const wasAlreadyPaid = await this.markPaidIdempotent(payment);
    return Object.assign(payment, { _wasAlreadyPaid: wasAlreadyPaid });
  }

  async confirmWaveCheckoutCompleted(
    sessionId: string,
  ): Promise<(Payment & { _wasAlreadyPaid: boolean }) | null> {
    const payment = await this.repo.findOne({
      where: { provider_payment_id: sessionId, provider: PaymentProvider.WAVE },
    });
    if (!payment) return null;

    const wasAlreadyPaid = await this.markPaidIdempotent(payment);
    return Object.assign(payment, { _wasAlreadyPaid: wasAlreadyPaid });
  }

  /**
   * Appelé sur `payment_intent.payment_failed` — ne fait jamais régresser un
   * paiement déjà confirmé (webhooks Stripe parfois désordonnés/rejoués).
   */
  async markFailed(paymentIntentId: string, reason: string): Promise<Payment | null> {
    const payment = await this.repo.findOne({ where: { provider_payment_id: paymentIntentId } });
    if (!payment || payment.status === PaymentStatus.PAID) {
      return null;
    }
    payment.status = PaymentStatus.FAILED;
    payment.failure_reason = reason;
    return this.repo.save(payment);
  }

  async getByOrder(orderId: string): Promise<Payment> {
    const payment = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payment) throw new RpcException({ statusCode: 404, message: 'Paiement introuvable' });
    return payment;
  }

  /** Dernier paiement Stripe d'une commande (une reprise de paiement en crée un nouveau). */
  async findLatestStripeByOrder(orderId: string): Promise<Payment | null> {
    return this.repo.findOne({
      where: { order_id: orderId, provider: PaymentProvider.STRIPE },
      order: { created_at: 'DESC' },
    });
  }

  async refund(orderId: string, amount_cents?: number): Promise<Payment> {
    // Verrou pessimiste sur la ligne du paiement — deux remboursements admin
    // quasi simultanés sur le même paiement ne doivent jamais tous les deux
    // lire le même refunded_amount et cumuler un montant total supérieur au
    // payé. Le second appel attend que le premier ait committé, puis relit
    // le solde à jour.
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .createQueryBuilder(Payment, 'payment')
        .setLock('pessimistic_write')
        .where('payment.order_id = :orderId', { orderId })
        .getOne();

      if (!payment) {
        throw new RpcException({ statusCode: 404, message: 'Paiement introuvable' });
      }

      if (
        payment.status !== PaymentStatus.PAID &&
        payment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new RpcException({
          statusCode: 400,
          message: 'Le paiement n\'est pas remboursable dans son état actuel',
        });
      }

      const alreadyRefunded = Number(payment.refunded_amount ?? 0);
      const remaining = parseFloat((Number(payment.amount) - alreadyRefunded).toFixed(2));
      const requestedAmount = amount_cents ? amount_cents / 100 : remaining;

      if (requestedAmount <= 0 || requestedAmount > remaining + 0.01) {
        throw new RpcException({
          statusCode: 400,
          message: `Montant de remboursement invalide (solde restant : ${remaining} €)`,
        });
      }

      const providerImplementation = this.providerImplementationFor(payment.provider);
      await providerImplementation.refund(payment.provider_payment_id, amount_cents);

      payment.refunded_amount = parseFloat((alreadyRefunded + requestedAmount).toFixed(2));
      payment.refunded_at = new Date();
      // Remboursement total dès que le solde restant est épuisé (couvre aussi
      // un remboursement partiel qui, cumulé aux précédents, atteint le total).
      payment.status =
        payment.refunded_amount >= Number(payment.amount) - 0.01
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      const saved = await manager.save(payment);

      // Recalcule le reversement organisateur correspondant — ne doit jamais
      // faire échouer le remboursement lui-même si le payout est introuvable
      // ou si payment-service rencontre un souci ponctuel.
      await this.payoutService
        .recalculateForRefund(orderId, requestedAmount, Number(payment.amount))
        .catch(() => undefined);

      return saved;
    });
  }
}
