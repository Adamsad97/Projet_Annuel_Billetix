// Client pour les endpoints /tickets/resale de l'api-gateway
// (backend/api-gateway/src/ticket/ticket.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";

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

// Revente réservée aux acheteurs connectés : lecture authentifiée (Bearer),
// donc depuis un composant client uniquement.
export function listResaleListings(): Promise<ApiResaleListing[]> {
  return apiGet<ApiResaleListing[]>("/tickets/resale");
}

export function getResaleListing(resaleId: string): Promise<ApiResaleListing> {
  return apiGet<ApiResaleListing>(`/tickets/resale/${resaleId}`);
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
