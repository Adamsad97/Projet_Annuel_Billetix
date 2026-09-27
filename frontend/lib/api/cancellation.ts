// Demandes d'annulation d'un événement : l'organisateur demande, un admin
// accepte (annulation + remboursement des acheteurs) ou refuse, après un
// échange de messages (api-gateway : /events/... et /admin/cancellation-requests).

import { apiGet, apiPost } from "./client";

export type CancellationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface ApiCancellationMessage {
  id: string;
  author_id: string;
  author_role: "ORGANIZER" | "ADMIN";
  message: string;
  created_at: string;
}

export interface ApiCancellationRequest {
  id: string;
  event_id: string;
  organizer_id: string;
  reason: string;
  status: CancellationStatus;
  decided_at: string | null;
  messages: ApiCancellationMessage[];
  created_at: string;
  // Enrichis pour l'admin.
  organizer_name?: string | null;
  organizer_email?: string | null;
  event_title?: string | null;
  event_start_date?: string | null;
}

export const cancellationStatusLabels: Record<CancellationStatus, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  APPROVED: { label: "Acceptée", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  REJECTED: { label: "Refusée", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  WITHDRAWN: { label: "Retirée", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
};

// ─── Organisateur ───────────────────────────────────────────────────────────

export function requestEventCancellation(eventId: string, reason: string): Promise<ApiCancellationRequest> {
  return apiPost(`/events/${eventId}/cancellation-requests`, { reason });
}

export function listEventCancellationRequests(eventId: string): Promise<ApiCancellationRequest[]> {
  return apiGet(`/events/${eventId}/cancellation-requests`);
}

export function replyToCancellation(requestId: string, message: string): Promise<ApiCancellationRequest> {
  return apiPost(`/events/cancellation-requests/${requestId}/messages`, { message });
}

export function withdrawCancellation(requestId: string): Promise<ApiCancellationRequest> {
  return apiPost(`/events/cancellation-requests/${requestId}/withdraw`, {});
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export function listCancellationRequests(params: {
  status?: CancellationStatus;
  limit?: number;
  offset?: number;
}): Promise<{ data: ApiCancellationRequest[]; total: number }> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiGet(`/admin/cancellation-requests${qs ? `?${qs}` : ""}`);
}

export function getPendingCancellationCount(): Promise<{ count: number }> {
  return apiGet("/admin/cancellation-requests/pending-count");
}

export function listAdminEventCancellationRequests(eventId: string): Promise<ApiCancellationRequest[]> {
  return apiGet(`/admin/events/${eventId}/cancellation-requests`);
}

export function adminReplyToCancellation(requestId: string, message: string): Promise<ApiCancellationRequest> {
  return apiPost(`/admin/cancellation-requests/${requestId}/messages`, { message });
}

export function approveCancellation(requestId: string, message?: string): Promise<ApiCancellationRequest> {
  return apiPost(`/admin/cancellation-requests/${requestId}/approve`, { message });
}

export function rejectCancellation(requestId: string, message: string): Promise<ApiCancellationRequest> {
  return apiPost(`/admin/cancellation-requests/${requestId}/reject`, { message });
}
