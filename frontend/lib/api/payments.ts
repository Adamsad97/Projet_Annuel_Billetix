// Client des endpoints /payments de la passerelle (Stripe).

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

/** Vérification de secours : le serveur interroge Stripe et génère billets et email si le paiement est encaissé. */
export function syncOrderPayment(
  orderId: string,
): Promise<{ status: "paid" | "failed" | "pending" | "unknown" }> {
  return apiPost(`/payments/orders/${orderId}/sync`);
}
