// Client pour les endpoints /payments de l'api-gateway
// (backend/api-gateway/src/payment/payment.controller.ts). Câblage réel —
// seul Stripe est configuré avec de vraies clés de test pour l'instant.

import { apiGet, apiPost } from "./client";

export interface PaymentIntentResult {
  payment_id: string;
  provider: string;
  client_secret?: string;
  redirect_url?: string;
}

export function createPaymentIntent(orderId: string): Promise<PaymentIntentResult> {
  return apiPost<PaymentIntentResult>("/payments/intent", { order_id: orderId });
}

export interface ApiPayment {
  id: string;
  order_id: string;
  status: string;
  provider: string;
  amount_ttc: number;
}

export function getPaymentByOrder(orderId: string): Promise<ApiPayment> {
  return apiGet<ApiPayment>(`/payments/order/${orderId}`);
}
