import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProviderPort,
  RefundResult,
} from './payment-provider.interface';

interface PaypalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

interface PaypalCapture {
  id: string;
  status: string;
}

/**
 * Intégration réelle contre l'API REST PayPal Orders v2 (fetch natif Node,
 * pas de SDK tiers). Testable dès que PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET
 * (déjà prévus dans l'environnement) sont renseignés avec des identifiants
 * sandbox PayPal Developer.
 */
@Injectable()
export class PaypalProvider implements PaymentProviderPort {
  private readonly logger = new Logger(PaypalProvider.name);
  private readonly apiBase: string;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');
    this.apiBase =
      mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt > Date.now()) {
      return this.cachedAccessToken.token;
    }

    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal OAuth2 échoué (${response.status}) : ${await response.text()}`);
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    // Marge de sécurité de 60s avant l'expiration réelle du jeton.
    this.cachedAccessToken = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in - 60) * 1000,
    };
    return body.access_token;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const accessToken = await this.getAccessToken();
    const amountValue = (params.amountCents / 100).toFixed(2);

    const response = await fetch(`${this.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: params.orderId,
            amount: { currency_code: params.currency.toUpperCase(), value: amountValue },
          },
        ],
        application_context: {
          brand_name: 'BilletiX',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PayPal création de commande échouée (${response.status}) : ${await response.text()}`);
    }

    const order = (await response.json()) as PaypalOrder;
    const approveLink = order.links.find((link) => link.rel === 'approve')?.href;

    return { providerPaymentId: order.id, redirectUrl: approveLink };
  }

  /**
   * Capture les fonds d'une commande PayPal approuvée par l'acheteur.
   * Retourne l'ID de capture — c'est CET identifiant (pas l'ID de commande)
   * qui doit être utilisé ensuite pour un remboursement.
   */
  async captureOrder(paypalOrderId: string): Promise<{ captureId: string; status: string }> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.apiBase}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal capture échouée (${response.status}) : ${await response.text()}`);
    }

    const result = (await response.json()) as {
      status: string;
      purchase_units: Array<{ payments: { captures: PaypalCapture[] } }>;
    };
    const capture = result.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      throw new Error('PayPal capture : aucune capture trouvée dans la réponse');
    }

    return { captureId: capture.id, status: result.status };
  }

  async refund(providerPaymentId: string, amountCents?: number): Promise<RefundResult> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${this.apiBase}/v2/payments/captures/${providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: amountCents
          ? JSON.stringify({ amount: { currency_code: 'EUR', value: (amountCents / 100).toFixed(2) } })
          : undefined,
      },
    );

    if (!response.ok) {
      throw new Error(`PayPal remboursement échoué (${response.status}) : ${await response.text()}`);
    }

    const refund = (await response.json()) as { id: string };
    return { refundId: refund.id };
  }

  /**
   * Vérifie l'authenticité d'un webhook PayPal via l'API officielle de
   * vérification de signature (nécessite PAYPAL_WEBHOOK_ID, configuré côté
   * PayPal Developer Dashboard sur l'URL de webhook de ce projet).
   */
  async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<boolean> {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID non configuré — vérification de signature webhook impossible');
      return false;
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.apiBase}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id: headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url: headers['paypal-cert-url'],
        auth_algo: headers['paypal-auth-algo'],
        transmission_sig: headers['paypal-transmission-sig'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    if (!response.ok) return false;
    const result = (await response.json()) as { verification_status: string };
    return result.verification_status === 'SUCCESS';
  }
}
