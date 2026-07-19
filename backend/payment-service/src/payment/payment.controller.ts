import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
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
