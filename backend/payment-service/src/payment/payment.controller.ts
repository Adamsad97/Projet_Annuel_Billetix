import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { StripeService } from '../stripe/stripe.service';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripe: StripeService,
  ) {}

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

  @MessagePattern('payment.get_by_order')
  getByOrder(@Payload() data: { order_id: string }) {
    return this.paymentService.getByOrder(data.order_id);
  }

  @MessagePattern('payment.refund')
  refund(@Payload() data: { order_id: string; amount_cents?: number }) {
    return this.paymentService.refund(data.order_id, data.amount_cents);
  }
}
