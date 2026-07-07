import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutService } from '../payout/payout.service';
import { StripeService } from '../stripe/stripe.service';
import { Payment, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    private readonly stripe: StripeService,
    private readonly payoutService: PayoutService,
  ) {}

  async createIntent(data: {
    order_id: string;
    amount_ttc: number;
    buyer_email: string;
  }): Promise<{ client_secret: string; payment_id: string }> {
    const existing = await this.repo.findOne({ where: { order_id: data.order_id } });
    if (existing && existing.status === PaymentStatus.PAID) {
      throw new RpcException({ statusCode: 409, message: 'Commande déjà payée' });
    }

    const amount_cents = Math.round(Number(data.amount_ttc) * 100);
    const { client_secret, payment_intent_id } = await this.stripe.createPaymentIntent({
      amount_cents,
      currency: 'eur',
      order_id: data.order_id,
      buyer_email: data.buyer_email,
    });

    const payment = existing ?? this.repo.create({ order_id: data.order_id, amount: data.amount_ttc });
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

    const wasAlreadyPaid = payment.status === PaymentStatus.PAID;
    if (!wasAlreadyPaid) {
      payment.status = PaymentStatus.PAID;
      await this.repo.save(payment);
    }

    return Object.assign(payment, { _wasAlreadyPaid: wasAlreadyPaid });
  }

  async getByOrder(orderId: string): Promise<Payment> {
    const payment = await this.repo.findOne({ where: { order_id: orderId } });
    if (!payment) throw new RpcException({ statusCode: 404, message: 'Paiement introuvable' });
    return payment;
  }

  async refund(orderId: string, amount_cents?: number): Promise<Payment> {
    const payment = await this.getByOrder(orderId);
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

    const saved = await this.repo.save(payment);

    // Recalcule le reversement organisateur correspondant — ne doit jamais
    // faire échouer le remboursement lui-même si le payout est introuvable
    // ou si payment-service rencontre un souci ponctuel.
    await this.payoutService
      .recalculateForRefund(orderId, requestedAmount, Number(payment.amount))
      .catch(() => undefined);

    return saved;
  }
}
