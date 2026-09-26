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

/**
 * Vérification de secours : le serveur interroge Stripe sur l'état réel du
 * paiement de la commande et, s'il est encaissé, génère billets et email
 * (même traitement que le webhook, sans double génération).
 */
export function syncOrderPayment(
  orderId: string,
): Promise<{ status: "paid" | "failed" | "pending" | "unknown" }> {
  return apiPost(`/payments/orders/${orderId}/sync`);
}
