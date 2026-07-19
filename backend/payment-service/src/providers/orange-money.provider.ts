import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProviderPort,
  RefundResult,
} from './payment-provider.interface';

/**
 * Intégration contre l'API Orange Money Web Payment (Orange Developer
 * Center), fetch natif Node. ⚠️ Jamais testée en conditions réelles — aucun
 * compte marchand Orange Money disponible pour ce projet étudiant. Le code
 * suit la documentation publique de l'API mais doit être validé avec de
 * vrais identifiants (ORANGE_MONEY_CLIENT_ID/SECRET/MERCHANT_KEY) avant
 * toute mise en production.
 */
@Injectable()
export class OrangeMoneyProvider implements PaymentProviderPort {
  private readonly logger = new Logger(OrangeMoneyProvider.name);
  private readonly apiBase: string;
  private readonly country: string;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiBase = this.config.get<string>('ORANGE_MONEY_API_BASE', 'https://api.orange.com');
    this.country = this.config.get<string>('ORANGE_MONEY_COUNTRY', 'sn'); // Sénégal par défaut
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt > Date.now()) {
      return this.cachedAccessToken.token;
    }

    const clientId = this.config.get<string>('ORANGE_MONEY_CLIENT_ID');
    const clientSecret = this.config.get<string>('ORANGE_MONEY_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${this.apiBase}/oauth/v3/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Orange Money OAuth échoué (${response.status}) : ${await response.text()}`);
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedAccessToken = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in - 60) * 1000,
    };
    return body.access_token;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const accessToken = await this.getAccessToken();
    const merchantKey = this.config.get<string>('ORANGE_MONEY_MERCHANT_KEY');
    const currency = this.config.get<string>('ORANGE_MONEY_CURRENCY', 'OUV');

    const response = await fetch(
      `${this.apiBase}/orange-money-webpay/${this.country}/v1/webpayment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_key: merchantKey,
          currency,
          order_id: params.orderId,
          // Orange Money attend un montant entier (pas de centimes) dans
          // l'unité de la devise configurée — conversion à la charge de
          // l'intégrateur si la devise de la commande diffère (EUR vs XOF).
          amount: Math.round(params.amountCents / 100),
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          notif_url: `${params.returnUrl.split('/orders/')[0]}/payments/webhook/orange-money`,
          lang: 'fr',
          reference: 'BilletiX',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Orange Money création de paiement échouée (${response.status}) : ${await response.text()}`);
    }

    const result = (await response.json()) as {
      payment_url: string;
      pay_token: string;
      notif_token: string;
    };

    return {
      providerPaymentId: result.pay_token,
      redirectUrl: result.payment_url,
      notifToken: result.notif_token,
    };
  }

  /**
   * Orange Money ne fournit pas d'API de remboursement en libre-service
   * dans la plupart des pays — les remboursements se font manuellement via
   * le portail marchand Orange Money. On lève une erreur explicite plutôt
   * que de simuler un remboursement qui n'aurait aucun effet réel.
   */
  async refund(): Promise<RefundResult> {
    this.logger.error(
      "Remboursement Orange Money impossible via l'API — à effectuer manuellement depuis le portail marchand Orange Money",
    );
    throw new RpcException({
      statusCode: 400,
      message:
        "L'API Orange Money ne permet pas de remboursement automatique — contactez le support marchand Orange Money",
    });
  }

  /** Revérifie le statut réel de la transaction auprès d'Orange Money (plus fiable que le seul contenu du callback). */
  async getTransactionStatus(payToken: string, orderId: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const merchantKey = this.config.get<string>('ORANGE_MONEY_MERCHANT_KEY');

    const response = await fetch(
      `${this.apiBase}/orange-money-webpay/${this.country}/v1/transactionstatus`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId, amount: undefined, pay_token: payToken, merchant_key: merchantKey }),
      },
    );

    if (!response.ok) {
      throw new Error(`Orange Money vérification de statut échouée (${response.status}) : ${await response.text()}`);
    }

    const result = (await response.json()) as { status: string };
    return result.status;
  }
}
