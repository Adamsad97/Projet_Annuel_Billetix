// Client pour les endpoints /events de l'api-gateway
// (backend/api-gateway/src/event/event.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";
import { ApiError, extractErrorMessage } from "./http-error";
import type { ApiTicket } from "./tickets";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Correspond exactement à l'enum EventStatus du backend (event.entity.ts) —
// un rejet ne crée pas de statut "REJECTED" séparé : l'événement repasse en
// DRAFT avec rejection_reason renseigné (cf. EventService.reject).
export type ApiEventStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "PUBLISHED"
  | "SUSPENDED"
  | "CANCELLED"
  | "TERMINATED"
  | "ARCHIVED";

export interface ApiEvent {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  // Code d'une catégorie gérée depuis l'espace Admin (cf. lib/api/categories.ts).
  category: string;
  status: ApiEventStatus;
  is_non_profit: boolean;
  start_date: string;
  end_date: string;
  timezone: string;
  venue_name: string;
  venue_address_line1: string;
  venue_address_line2: string | null;
  venue_city: string;
  venue_postal_code: string;
  venue_country: string;
  poster_url: string | null;
  total_capacity: number;
  sales_start_date: string;
  sales_end_date: string;
  refund_policy: "NON_REFUNDABLE" | "REFUNDABLE";
  refund_deadline_days: number | null;
  access_conditions: string | null;
  commission_rate: string;
  rejection_reason: string | null;
  suspension_reason: string | null;
  cancellation_reason: string | null;
  validated_at: string | null;
}

export interface ApiTicketCategory {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_ht: string;
  quota: number;
  remaining_quota: number;
  max_per_order: number;
  visibility: "PUBLIC" | "PRIVATE";
  is_active: boolean;
}

export interface ListEventsParams {
  category?: string;
  city?: string;
  page?: number;
  q?: string;
  min_price?: number;
  max_price?: number;
}

export interface ListEventsResult {
  data: ApiEvent[];
  total: number;
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.",
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractErrorMessage(data, "Une erreur est survenue, réessaie."),
    );
  }

  return data as T;
}

export function listPublishedEvents(
  params: ListEventsParams = {},
): Promise<ListEventsResult> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return getJson<ListEventsResult>(`/events${qs ? `?${qs}` : ""}`);
}

export function getEvent(id: string): Promise<ApiEvent> {
  return getJson<ApiEvent>(`/events/${id}`);
}

export function getEventCategories(id: string): Promise<ApiTicketCategory[]> {
  return getJson<ApiTicketCategory[]>(`/events/${id}/categories`);
}

export interface CreateEventDto {
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  venue_address_line1: string;
  venue_city: string;
  venue_postal_code: string;
  venue_country: string;
  poster_url: string;
  total_capacity: number;
  sales_start_date: string;
  sales_end_date: string;
  refund_policy: "NON_REFUNDABLE" | "REFUNDABLE";
}

export function createEvent(dto: CreateEventDto): Promise<ApiEvent> {
  return apiPost<ApiEvent>("/events", dto);
}

export interface CreateTicketCategoryDto {
  name: string;
  price_ht: number;
  quota: number;
  max_per_order?: number;
}

export function createTicketCategory(
  eventId: string,
  dto: CreateTicketCategoryDto,
): Promise<ApiTicketCategory> {
  return apiPost<ApiTicketCategory>(`/events/${eventId}/categories`, dto);
}

export function submitEventForValidation(eventId: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/events/${eventId}/submit`);
}

export function duplicateEvent(eventId: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/events/${eventId}/duplicate`);
}

export function cancelEvent(eventId: string, reason?: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/events/${eventId}/cancel`, { reason });
}

export interface ApiValidationRequest {
  id: string;
  event_id: string;
  admin_id: string;
  message: string;
  responded_at: string | null;
  response: string | null;
  created_at: string;
}

export function getValidationRequests(eventId: string): Promise<ApiValidationRequest[]> {
  return apiGet<ApiValidationRequest[]>(`/events/${eventId}/validation-requests`);
}

export function respondToValidationRequest(requestId: string, response: string): Promise<{ success: true }> {
  return apiPost<{ success: true }>(`/events/validation-requests/${requestId}/respond`, { response });
}

export interface ApiEventFillStats {
  total_quota: number;
  remaining: number;
  sold: number;
  fill_rate: number;
  categories: Array<{
    id: string;
    name: string;
    quota: number;
    remaining_quota: number;
    sold: number;
    price_ht: number;
  }>;
}

export interface ApiEventRevenue {
  orders_count: number;
  revenue_ht: number;
  revenue_ttc: number;
  total_commission: number;
  net_organizer_amount: number;
}

export interface ApiEventTicketStats {
  total: number;
  used: number;
  active: number;
  cancelled: number;
  for_resale: number;
}

export interface ApiEventDashboardDetail {
  event: ApiEvent;
  fill_stats: ApiEventFillStats;
  revenue: ApiEventRevenue;
  tickets: ApiEventTicketStats;
}

export function getEventDashboardDetail(eventId: string): Promise<ApiEventDashboardDetail> {
  return apiGet<ApiEventDashboardDetail>(`/events/${eventId}/dashboard`);
}

export function getEventAttendees(eventId: string): Promise<ApiTicket[]> {
  return apiGet<ApiTicket[]>(`/events/${eventId}/attendees`);
}
