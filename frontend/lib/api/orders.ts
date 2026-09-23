// Client pour les endpoints /orders de l'api-gateway
// (backend/api-gateway/src/order/order.controller.ts). Câblage réel.

import { apiDelete, apiGet, apiPost } from "./client";

export type ApiPaymentMethod =
  | "STRIPE"
  | "PAYPAL"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "ORANGE_MONEY"
  | "WAVE";

export type ApiOrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "TICKETS_SENT"
  | "CANCELLED"
  | "REFUNDED";

export interface ReserveStockItem {
  ticket_category_id: string;
  quantity: number;
}

export interface ReservationResult {
  reservation_token: string;
  expires_at: string;
}

export interface OrderItemInput extends ReserveStockItem {
  holder_first_name?: string;
  holder_last_name?: string;
  seat_info?: string;
}

export interface CreateOrderPayload {
  event_id: string;
  reservation_token: string;
  items: OrderItemInput[];
  promo_code?: string;
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  billing_address_line1: string;
  billing_address_line2?: string;
  billing_city: string;
  billing_postal_code: string;
  billing_country: string;
  payment_method: ApiPaymentMethod;
}

export interface ApiOrder {
  id: string;
  reference: string;
  status: ApiOrderStatus;
  total_amount_ttc: number;
  total_commission: number;
  discount_amount: number;
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  payment_method: ApiPaymentMethod;
  event_name: string | null;
  event_start_at: string | null;
  event_venue_name: string | null;
  event_city: string | null;
  buyer_email: string | null;
  buyer_first_name: string | null;
  invoice_url: string | null;
  created_at: string;
}

export interface ApiOrderItem {
  id: string;
  ticket_category_name: string;
  quantity: number;
  unit_price_ttc: number;
  total_price_ttc: number;
}

export interface OrderDetailResult {
  order: ApiOrder;
  items: ApiOrderItem[];
}

export function reserveStock(
  eventId: string,
  items: ReserveStockItem[],
): Promise<ReservationResult> {
  return apiPost<ReservationResult>("/orders/reserve", {
    event_id: eventId,
    items,
  });
}

export function releaseReservation(token: string): Promise<void> {
  return apiDelete(`/orders/reserve/${token}`);
}

export function createOrder(payload: CreateOrderPayload): Promise<OrderDetailResult> {
  return apiPost<OrderDetailResult>("/orders", payload);
}

export function getOrder(id: string): Promise<OrderDetailResult> {
  return apiGet<OrderDetailResult>(`/orders/${id}`);
}

export function getMyOrders(): Promise<ApiOrder[]> {
  return apiGet<ApiOrder[]>("/orders/me");
}

export function resendTickets(orderId: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/orders/${orderId}/resend-tickets`);
}
