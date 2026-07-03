import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeService } from '../stripe/stripe.service';
import { Payment, PaymentStatus } from './payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
    private readonly stripe: StripeService,
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
    if (payment.status !== PaymentStatus.PAID) {
      throw new RpcException({ statusCode: 400, message: 'Le paiement n\'est pas confirmé' });
    }
    await this.stripe.createRefund(payment.provider_payment_id, amount_cents);
    payment.status = PaymentStatus.REFUNDED;
    payment.refunded_at = new Date();
    payment.refunded_amount = amount_cents ? amount_cents / 100 : Number(payment.amount);
    return this.repo.save(payment);
  }
}
