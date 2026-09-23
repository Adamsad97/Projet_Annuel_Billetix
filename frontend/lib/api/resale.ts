// Client pour les endpoints /tickets/resale de l'api-gateway
// (backend/api-gateway/src/ticket/ticket.controller.ts). Câblage réel.

import { getApiBaseUrl } from "./base-url";
import { apiGet, apiPost } from "./client";
import { ApiError, extractErrorMessage } from "./http-error";

const API_URL = getApiBaseUrl();

export interface ApiResaleListing {
  id: string;
  ticket_id: string;
  original_order_id: string;
  original_buyer_id: string;
  resale_price: number;
  status: "LISTED" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";
  event_id: string;
  event_start_at: string;
  ticket_category_id: string;
  holder_first_name: string;
  holder_last_name: string;
  // Ajoutés par l'enrichissement côté gateway (enrichResaleListings).
  event_name: string;
  event_venue_name: string;
  event_city: string;
  event_poster_url: string | null;
  category_name: string;
}

// Lecture publique (pas de token requis) — même pattern que listPublishedEvents
// (lib/api/events.ts), safe à appeler depuis un composant serveur.
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

export function listResaleListings(): Promise<ApiResaleListing[]> {
  return getPublicJson<ApiResaleListing[]>("/tickets/resale");
}

export function getResaleListing(resaleId: string): Promise<ApiResaleListing> {
  return getPublicJson<ApiResaleListing>(`/tickets/resale/${resaleId}`);
}

export interface PurchaseResaleDto {
  billing_first_name: string;
  billing_last_name: string;
  billing_email: string;
  billing_address_line1: string;
  billing_address_line2?: string;
  billing_city: string;
  billing_postal_code: string;
  billing_country: string;
  payment_method: string;
}

export interface PurchaseResaleResult {
  resale_id: string;
  order_id: string;
  client_secret?: string;
}

export function purchaseResale(
  resaleId: string,
  dto: PurchaseResaleDto,
): Promise<PurchaseResaleResult> {
  return apiPost<PurchaseResaleResult>(`/tickets/resale/${resaleId}/purchase`, dto);
}

export function completeResale(
  resaleId: string,
  orderId: string,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/tickets/resale/${resaleId}/complete`, { order_id: orderId });
}

// null si ce billet n'est pas actuellement en vente.
export function getActiveResaleForTicket(ticketId: string): Promise<ApiResaleListing | null> {
  return apiGet<ApiResaleListing | null>(`/tickets/${ticketId}/resale`);
}

export function withdrawResale(resaleId: string): Promise<ApiResaleListing> {
  return apiPost<ApiResaleListing>(`/tickets/resale/${resaleId}/withdraw`);
}
