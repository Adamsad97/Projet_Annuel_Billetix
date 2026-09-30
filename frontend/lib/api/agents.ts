// Client des agents de contrôle d'un événement (api-gateway,
// /tickets/event/:eventId/agents) — réservé à l'organisateur de l'événement.

import { apiDelete, apiGet, apiPost } from "./client";

export interface ApiEventAgent {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  /** Compte créé par invitation, mot de passe pas encore choisi. */
  invitation_pending: boolean;
  is_supervisor: boolean;
  assigned_at: string;
  last_activity_at: string | null;
}

export interface InviteAgentInput {
  email: string;
  first_name: string;
  last_name: string;
}

export function listEventAgents(eventId: string): Promise<ApiEventAgent[]> {
  return apiGet<ApiEventAgent[]>(`/tickets/event/${eventId}/agents`);
}

/** `account_created` : un compte agent a été créé et un lien envoyé pour choisir le mot de passe. */
export function inviteEventAgent(eventId: string, input: InviteAgentInput): Promise<{ user_id: string; account_created: boolean }> {
  return apiPost(`/tickets/event/${eventId}/agents`, input);
}

export function removeEventAgent(eventId: string, userId: string): Promise<{ success: boolean }> {
  return apiDelete(`/tickets/event/${eventId}/agents/${userId}`);
}

export interface BulkInviteResult {
  email: string;
  /** invited : compte créé et lien envoyé ; assigned : agent existant affecté. */
  status: "invited" | "assigned" | "error";
  message?: string;
}

/** Plusieurs invitations en un envoi, résultat ligne par ligne. */
export function inviteEventAgentsBulk(eventId: string, agents: InviteAgentInput[]): Promise<{ results: BulkInviteResult[] }> {
  return apiPost(`/tickets/event/${eventId}/agents/bulk`, { agents });
}
