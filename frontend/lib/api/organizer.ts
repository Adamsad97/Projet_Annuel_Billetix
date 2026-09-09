// Client pour les endpoints organisateur de l'api-gateway
// (backend/api-gateway/src/event/event.controller.ts,
// backend/api-gateway/src/payment/payment.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";

export type ApiEventStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "PUBLISHED"
  | "CANCELLED"
  | "TERMINATED"
  | "ARCHIVED"
  | "SUSPENDED";

export interface ApiOrganizerEventSummary {
  id: string;
  title: string;
  status: ApiEventStatus;
  start_date: string;
  category: string;
  venue_name: string;
  venue_city: string;
  sold: number;
  total_quota: number;
  fill_rate: number;
  revenue_ttc: number;
}

export interface ApiOrganizerDashboard {
  totals: {
    events_count: number;
    upcoming_events_count: number;
    revenue_ttc: number;
    tickets_sold: number;
    pending_balance: number;
    total_earned: number;
  };
  events: ApiOrganizerEventSummary[];
}

export function getOrganizerDashboard(): Promise<ApiOrganizerDashboard> {
  return apiGet<ApiOrganizerDashboard>("/events/me/dashboard");
}

export type ApiPayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "BLOCKED" | "FAILED";

export interface ApiPayout {
  id: string;
  event_id: string;
  // Enrichis côté gateway (payment.controller.ts myPayouts) — le reversement
  // ne connaît en base que l'event_id.
  event_title: string | null;
  event_venue_name: string | null;
  status: ApiPayoutStatus;
  gross_amount: number;
  commission_amount: number;
  payment_fees_amount: number;
  net_amount: number;
  scheduled_at: string;
  processed_at: string | null;
  blocked_reason: string | null;
  requested_early_at: string | null;
}

export function getMyPayouts(): Promise<ApiPayout[]> {
  return apiGet<ApiPayout[]>("/payments/payouts/me");
}

export interface ApiOrganizerBalance {
  pending_balance: number;
  total_earned: number;
  payouts_count: number;
}

export function getMyBalance(): Promise<ApiOrganizerBalance> {
  return apiGet<ApiOrganizerBalance>("/payments/balance/me");
}

export function requestEarlyPayout(payoutId: string): Promise<ApiPayout> {
  return apiPost<ApiPayout>(`/payments/payouts/${payoutId}/request-early`);
}
