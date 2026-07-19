import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProviderPort,
  RefundResult,
} from './payment-provider.interface';

/**
 * Intégration contre l'API Wave Checkout (Wave for Business), fetch natif
 * Node. ⚠️ Jamais testée en conditions réelles — aucun compte marchand Wave
 * disponible pour ce projet étudiant. Le code suit la documentation
 * publique de l'API mais doit être validé avec une vraie clé API
 * (WAVE_API_KEY) avant toute mise en production.
 */
@Injectable()
export class WaveProvider implements PaymentProviderPort {
  private readonly logger = new Logger(WaveProvider.name);
  private readonly apiBase: string;

  constructor(private readonly config: ConfigService) {
    this.apiBase = this.config.get<string>('WAVE_API_BASE', 'https://api.wave.com');
  }

  private get apiKey(): string {
    return this.config.get<string>('WAVE_API_KEY');
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const currency = this.config.get<string>('WAVE_CURRENCY', 'XOF');

    const response = await fetch(`${this.apiBase}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Wave attend un montant en chaîne, dans l'unité de la devise (pas
        // de centimes pour XOF) — conversion à la charge de l'intégrateur
        // si la devise de la commande diffère (EUR vs XOF).
        amount: String(Math.round(params.amountCents / 100)),
        currency,
        error_url: params.cancelUrl,
        success_url: params.returnUrl,
        client_reference: params.orderId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Wave création de session échouée (${response.status}) : ${await response.text()}`);
    }

    const session = (await response.json()) as { id: string; wave_launch_url: string };
    return { providerPaymentId: session.id, redirectUrl: session.wave_launch_url };
  }

  async refund(providerPaymentId: string): Promise<RefundResult> {
    const response = await fetch(
      `${this.apiBase}/v1/checkout/sessions/${providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Wave remboursement échoué (${response.status}) : ${await response.text()}`);
    }

    return { refundId: providerPaymentId };
  }

  /**
   * Vérifie la signature HMAC-SHA256 du webhook Wave — format d'en-tête
   * `Wave-Signature: t=<timestamp>,v1=<signature>`, signature calculée sur
   * `${timestamp}${corpsBrut}` avec le secret webhook configuré.
   */
  verifyWebhookSignature(signatureHeader: string, rawBody: string): boolean {
    const webhookSecret = this.config.get<string>('WAVE_WEBHOOK_SECRET');
    if (!webhookSecret || !signatureHeader) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => part.split('=') as [string, string]),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}${rawBody}`)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch {
      return false;
    }
  }
}
