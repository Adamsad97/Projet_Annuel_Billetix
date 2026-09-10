// Client pour les endpoints /admin de l'api-gateway
// (backend/api-gateway/src/admin/admin.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";
import type { ApiEvent, CreateEventDto, CreateTicketCategoryDto } from "./events";

export interface ApiAdminDashboard {
  kpis: {
    orders_count: number;
    revenue_ht: number;
    revenue_ttc: number;
    total_commission: number;
    open_disputes: number;
    pending_payout_balance: number;
    total_paid_out: number;
    events_by_status: Record<string, number>;
    users: {
      by_role: Record<string, number>;
      suspended_count: number;
      total: number;
    };
  };
  alerts: Array<{ type: string; severity: "warning" | "critical"; message: string }>;
}

export function getAdminDashboard(): Promise<ApiAdminDashboard> {
  return apiGet<ApiAdminDashboard>("/admin/dashboard");
}

// ─── Tendance des ventes (métrique + plage de dates au choix) ──────────────

export interface ApiSalesTrendPoint {
  day: string;
  orders_count: number;
  tickets_count: number;
  revenue_ttc: number;
}

export function getSalesTrend(from?: string, to?: string): Promise<ApiSalesTrendPoint[]> {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return apiGet<ApiSalesTrendPoint[]>(`/admin/sales-trend${qs ? `?${qs}` : ""}`);
}

export interface ApiPendingEvent extends ApiEvent {
  validation_deadline: string;
  is_overdue: boolean;
  organizer_name: string | null;
  organizer_email: string | null;
}

export function getPendingEvents(): Promise<ApiPendingEvent[]> {
  return apiGet<ApiPendingEvent[]>("/admin/events/pending");
}

export function approveEvent(id: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/admin/events/${id}/approve`);
}

export function rejectEvent(id: string, reason: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/admin/events/${id}/reject`, { reason });
}

export function requestEventInfo(id: string, message: string): Promise<{ success: true }> {
  return apiPost<{ success: true }>(`/admin/events/${id}/request-info`, { message });
}

export function verifyNonProfit(id: string, approved: boolean): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/admin/events/${id}/verify-non-profit`, { approved });
}

// ─── Création d'événement pour un organisateur (accueil physique) ──────────

export type ApiUserRole = "BUYER" | "ORGANIZER" | "ADMIN" | "AGENT";

export interface ApiAdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: ApiUserRole;
  is_email_verified: boolean;
  two_factor_enabled: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
}

export function searchUsers(params: { q?: string; role?: string; is_suspended?: boolean; limit?: number; offset?: number }): Promise<{ data: ApiAdminUser[]; total: number }> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.role) search.set("role", params.role);
  if (params.is_suspended !== undefined) search.set("is_suspended", String(params.is_suspended));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiGet<{ data: ApiAdminUser[]; total: number }>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export interface ApiOrganizerProfile {
  user_id: string;
  display_name: string;
  bank_owner_name: string | null;
  stripe_connect_onboarded: boolean;
  kyc_status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  kyc_rejected_reason: string | null;
  kyc_document_url: string | null;
}

export function getAdminUser(id: string): Promise<{ user: ApiAdminUser; organizer_profile: ApiOrganizerProfile | null }> {
  return apiGet(`/admin/users/${id}`);
}

/** Compte trouvé mais pas encore organisateur (ex: déjà acheteur) — même
 * mécanisme que la page admin de gestion des comptes. */
export function changeUserRole(userId: string, role: "BUYER" | "ORGANIZER" | "ADMIN"): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${userId}/change-role`, { role });
}

export function suspendUser(id: string, reason: string): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${id}/suspend`, { reason });
}

export function unsuspendUser(id: string): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${id}/unsuspend`);
}

export function unlockUserAccount(id: string): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${id}/unlock`);
}

export function resetUserTwoFactor(id: string, reason: string): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${id}/reset-2fa`, { reason });
}

export function activateUserAccount(id: string): Promise<ApiAdminUser> {
  return apiPost<ApiAdminUser>(`/admin/users/${id}/activate`);
}

export function approveOrganizerKyc(userId: string): Promise<ApiOrganizerProfile> {
  return apiPost<ApiOrganizerProfile>(`/admin/kyc/${userId}/approve`);
}

export function rejectOrganizerKyc(userId: string, reason: string): Promise<ApiOrganizerProfile> {
  return apiPost<ApiOrganizerProfile>(`/admin/kyc/${userId}/reject`, { reason });
}

export function createEventForOrganizer(organizerId: string, dto: CreateEventDto): Promise<ApiEvent> {
  return apiPost<ApiEvent>("/admin/events", { organizer_id: organizerId, dto });
}

export function createCategoryForOrganizer(
  eventId: string,
  organizerId: string,
  dto: CreateTicketCategoryDto,
): Promise<unknown> {
  return apiPost(`/admin/events/${eventId}/categories`, { organizer_id: organizerId, dto });
}

export function submitEventForOrganizer(eventId: string, organizerId: string): Promise<ApiEvent> {
  return apiPost<ApiEvent>(`/admin/events/${eventId}/submit`, { organizer_id: organizerId });
}

export interface ApiAuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  performed_by: string;
  performed_by_email: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string;
  created_at: string;
}

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  performed_by?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<ApiAuditLogEntry[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  const result = await apiGet<{ logs: ApiAuditLogEntry[]; total: number }>(
    `/admin/audit-logs${qs ? `?${qs}` : ""}`,
  );
  return result.logs;
}
