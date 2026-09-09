// Client pour les noms de catégorie de billet ("Standard", "VIP"...) — GET
// /events/ticket-tier-types(/all) et CRUD /events/ticket-tier-types
// (backend/api-gateway/src/event/event.controller.ts, liste gérée depuis
// l'espace Admin, cf. backend/event-service/src/ticket-tier-type).

import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { ApiError, extractErrorMessage } from "./http-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface ApiTicketTierType {
  id: string;
  label: string;
  emoji: string | null;
  display_order: number;
  is_active: boolean;
}

async function getPublicJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON.
  }
  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(data, "Une erreur est survenue, réessaie."));
  }
  return data as T;
}

/** Noms actifs, pour le dropdown organisateur à la création d'une catégorie de billet. */
export function listTicketTierTypes(): Promise<ApiTicketTierType[]> {
  return getPublicJson<ApiTicketTierType[]>("/events/ticket-tier-types");
}

/** Tous les noms, y compris désactivés — réservé à l'espace Admin. */
export function listAllTicketTierTypes(): Promise<ApiTicketTierType[]> {
  return apiGet<ApiTicketTierType[]>("/events/ticket-tier-types/all");
}

export interface CreateTicketTierTypeDto {
  label: string;
  emoji?: string;
  display_order?: number;
}

export function createTicketTierType(dto: CreateTicketTierTypeDto): Promise<ApiTicketTierType> {
  return apiPost<ApiTicketTierType>("/events/ticket-tier-types", dto);
}

export interface UpdateTicketTierTypeDto {
  label?: string;
  emoji?: string;
  display_order?: number;
  is_active?: boolean;
}

export function updateTicketTierType(id: string, dto: UpdateTicketTierTypeDto): Promise<ApiTicketTierType> {
  return apiPatch<ApiTicketTierType>(`/events/ticket-tier-types/${id}`, dto);
}

export function deleteTicketTierType(id: string): Promise<{ success: true }> {
  return apiDelete<{ success: true }>(`/events/ticket-tier-types/${id}`);
}
