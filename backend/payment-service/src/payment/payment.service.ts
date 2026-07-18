import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { PayoutService } from '../payout/payout.service';
import { StripeService } from '../stripe/stripe.service';
import { Payment, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly stripe: StripeService,
    private readonly payoutService: PayoutService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  async createIntent(data: {
    order_id: string;
    buyer_id: string;
    buyer_email: string;
  }): Promise<{ client_secret: string; payment_id: string }> {
    const existing = await this.repo.findOne({ where: { order_id: data.order_id } });
    if (existing && existing.status === PaymentStatus.PAID) {
      throw new RpcException({ statusCode: 409, message: 'Commande déjà payée' });
    }

    // Le montant à payer n'est jamais fourni par le client — toujours relu
    // depuis order-service (source de vérité) pour empêcher un acheteur de
    // payer le montant de son choix pour n'importe quelle commande.
    const { order } = await firstValueFrom(
      this.orderClient.send('order.get', { id: data.order_id }),
    ) as { order: { buyer_id: string; total_amount_ttc: number } };

    if (order.buyer_id !== data.buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    const amount_ttc = Number(order.total_amount_ttc);
    const amount_cents = Math.round(amount_ttc * 100);
    const { client_secret, payment_intent_id } = await this.stripe.createPaymentIntent({
      amount_cents,
      currency: 'eur',
      order_id: data.order_id,
      buyer_email: data.buyer_email,
    });

    const payment = existing ?? this.repo.create({ order_id: data.order_id, amount: amount_ttc });
    payment.amount = amount_ttc;
    payment.provider_payment_id = payment_intent_id;
    payment.provider_client_secret = client_secret;
    await this.repo.save(payment);

    return { client_secret, payment_id: payment.id };
  }

  async confirmFromWebhook(paymentIntentId: string): Promise<Payment & { _wasAlreadyPaid: boolean }> {
    const payment = await this.repo.findOne({ where: { provider_payment_id: paymentIntentId } });
    if (!payment) {
      throw new RpcException({ statusCode: 404, message: 'Paiement introuvable' });
    }

    // Transition atomique vers PAID, uniquement depuis un statut non-payé.
    // Stripe redélivre parfois le même événement webhook (timeout, retry) —
    // sans cette garde au niveau SQL, deux appels quasi simultanés liraient
    // tous deux `status !== PAID` avant que l'un des deux ne sauvegarde,
    // provoquant une double génération de billets et un double reversement.
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

  async refund(orderId: string, amount_cents?: number): Promise<Payment> {
    // Verrou pessimiste sur la ligne du paiement — deux remboursements admin
    // quasi simultanés sur le même paiement ne doivent jamais tous les deux
    // lire le même refunded_amount et cumuler un montant total supérieur au
    // payé. Le second appel attend que le premier ait committé, puis relit
    // le solde à jour.
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.order_id = :orderId', { orderId })
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

      await this.stripe.createRefund(payment.provider_payment_id, amount_cents);

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
