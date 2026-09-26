// Client pour les endpoints /admin de l'api-gateway
// (backend/api-gateway/src/admin/admin.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";
import type { ApiEvent, CreateEventDto, CreateTicketCategoryDto } from "./events";
import type { ApiOrder } from "./orders";

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

// ─── Gestion globale des événements (tous statuts) ─────────────────────────
// Bug corrigé : cette page n'a jamais été reliée au backend, elle affichait
// des données 100% fictives (lib/mock/admin-events.ts) — aucun événement
// réel, publié ou non, n'y apparaissait jamais.

export interface ApiAdminEvent extends ApiEvent {
  organizer_name: string;
  category_label: string;
  category_emoji: string | null;
  sold: number;
  total_quota: number;
}

export function getAdminEvents(status?: string): Promise<ApiAdminEvent[]> {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<ApiAdminEvent[]>(`/admin/events${qs}`);
}

export function getAdminEvent(id: string): Promise<ApiAdminEvent> {
  return apiGet<ApiAdminEvent>(`/admin/events/${id}`);
}

// ─── Création d'événement pour un organisateur (accueil physique) ──────────

export type ApiUserRole = "BUYER" | "ORGANIZER" | "ADMIN" | "AGENT" | "SUPER_ADMIN";

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

export function getUserOrders(id: string): Promise<ApiOrder[]> {
  return apiGet<ApiOrder[]>(`/admin/users/${id}/orders`);
}

/** Pour un acheteur n'ayant rien reçu — équivalent support de
 * POST /orders/:id/resend-tickets (réservé au titulaire de la commande). */
export function resendOrderTicketsAsSupport(orderId: string): Promise<{ success: true }> {
  return apiPost<{ success: true }>(`/admin/orders/${orderId}/resend-tickets`);
}

/** Compte trouvé mais pas encore organisateur (ex: déjà acheteur) — même
 * mécanisme que la page admin de gestion des comptes. */
export function changeUserRole(userId: string, role: ApiUserRole): Promise<ApiAdminUser> {
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
  // Recherche libre (email, référence de billet, IP, détails…).
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Journal paginé : entrées de la page + nombre total de résultats. */
export function searchAuditLogs(filters: AuditLogFilters = {}): Promise<{ logs: ApiAuditLogEntry[]; total: number }> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return apiGet(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
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

// ─── Reversements ───────────────────────────────────────────────────────────

export type ApiPayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "BLOCKED" | "FAILED";

export interface ApiPayout {
  id: string;
  organizer_id: string;
  organizer_name: string;
  organizer_email: string | null;
  event_id: string;
  event_name: string;
  status: ApiPayoutStatus;
  gross_amount: number;
  commission_amount: number;
  payment_fees_amount: number;
  net_amount: number;
  stripe_transfer_id: string | null;
  scheduled_at: string;
  processed_at: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  requested_early_at: string | null;
  early_request_approved_by: string | null;
  created_at: string;
}

export interface ApiPayoutDetail extends ApiPayout {
  bank_owner_name: string | null;
}

export function getPayoutStats(): Promise<{
  pending_total: number;
  paid_this_month_total: number;
  blocked_total: number;
}> {
  return apiGet("/admin/payouts/stats");
}

export function listPayouts(params: { status?: string; limit?: number; offset?: number } = {}): Promise<{ data: ApiPayout[]; total: number }> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiGet(`/admin/payouts${qs ? `?${qs}` : ""}`);
}

export function getPayout(id: string): Promise<ApiPayoutDetail> {
  return apiGet(`/admin/payouts/${id}`);
}

export function blockPayout(id: string, reason: string): Promise<ApiPayout> {
  return apiPost(`/admin/payouts/${id}/block`, { reason });
}

export function unblockPayout(id: string): Promise<ApiPayout> {
  return apiPost(`/admin/payouts/${id}/unblock`);
}

export function processPayout(id: string): Promise<ApiPayout> {
  return apiPost(`/admin/payouts/${id}/process`);
}

export function approveEarlyPayout(id: string): Promise<ApiPayout> {
  return apiPost(`/admin/payouts/${id}/approve-early`);
}

// ─── Billets offerts (transferts entre comptes) ─────────────────────────────

export interface ApiTicketTransfer {
  id: string;
  ticket_id: string;
  ticket_reference: string;
  event_id: string;
  event_name: string;
  event_start_at: string;
  ticket_category_name: string;
  from_user_id: string;
  from_email: string;
  from_first_name: string;
  from_last_name: string;
  from_holder_first_name: string;
  from_holder_last_name: string;
  to_user_id: string;
  to_email: string;
  to_holder_first_name: string;
  to_holder_last_name: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  status: "ACTIVE" | "REVERTED";
  reverted_at: string | null;
  reverted_by_email: string | null;
  revert_reason: string | null;
  revert_source: "PHONE" | "PLATFORM" | null;
  // Demande de l'expéditeur en attente (liste admin uniquement).
  pending_revert_request?: ApiTransferRevertRequest | null;
}

export interface ApiTransferRevertRequest {
  id: string;
  transfer_id: string;
  ticket_id: string;
  requested_by: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decided_by_email: string | null;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
}

/** Demandes d'annulation (avec le transfert concerné). */
export function listTransferRevertRequests(params: { status?: string; page?: number; limit?: number }): Promise<{
  data: Array<ApiTransferRevertRequest & { transfer: ApiTicketTransfer | null }>;
  total: number;
}> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiGet(`/admin/tickets/transfer-revert-requests${query ? `?${query}` : ""}`);
}

/** Annule un transfert : billet rendu à l'expéditeur. */
export function revertTicketTransfer(
  transferId: string,
  data: { reason: string; source: "PHONE" | "PLATFORM"; request_id?: string },
): Promise<{ success: true }> {
  return apiPost(`/admin/tickets/transfers/${transferId}/revert`, data);
}

/** Refuse la demande d'annulation de l'expéditeur. */
export function rejectTransferRevert(requestId: string, reason: string): Promise<{ success: true }> {
  return apiPost(`/admin/tickets/transfer-revert-requests/${requestId}/reject`, { reason });
}

export function listTicketTransfers(params: { q?: string; page?: number; limit?: number }): Promise<{
  data: ApiTicketTransfer[];
  total: number;
  page: number;
  limit: number;
}> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiGet(`/admin/tickets/transfers${query ? `?${query}` : ""}`);
}

/** Chaîne complète des titulaires d'un billet. */
export function getTicketTransfers(ticketId: string): Promise<ApiTicketTransfer[]> {
  return apiGet(`/admin/tickets/${ticketId}/transfers`);
}

/** Billets offerts et reçus par un compte (fiche utilisateur). */
export function getUserTransfers(userId: string): Promise<ApiTicketTransfer[]> {
  return apiGet(`/admin/users/${userId}/transfers`);
}

// ─── Reventes ───────────────────────────────────────────────────────────────

export type ApiResaleStatus = "LISTED" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";

export interface ApiAdminResale {
  id: string;
  ticket_id: string;
  original_order_id: string;
  original_buyer_id: string;
  new_buyer_id: string | null;
  new_order_id: string | null;
  resale_price: string | number;
  status: ApiResaleStatus;
  event_start_at: string;
  listed_at: string;
  sold_at: string | null;
  reservation_expires_at: string | null;
  ticket_reference: string | null;
  event_name: string | null;
  ticket_category_name: string | null;
  face_value: number | null;
  seller: { email: string; first_name: string; last_name: string } | null;
  buyer: { email: string; first_name: string; last_name: string } | null;
}

export function listResales(params: { status?: string; q?: string; page?: number; limit?: number }): Promise<{
  data: ApiAdminResale[];
  total: number;
}> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return apiGet(`/admin/resales${query ? `?${query}` : ""}`);
}

/** Reventes d'un compte (vendeur ou acheteur) — fiche utilisateur. */
export function getUserResales(userId: string): Promise<ApiAdminResale[]> {
  return apiGet(`/admin/users/${userId}/resales`);
}
