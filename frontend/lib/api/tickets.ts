// Client pour les endpoints /tickets de l'api-gateway
// (backend/api-gateway/src/ticket/ticket.controller.ts). Câblage réel.

import { apiGet, apiPost } from "./client";

export type ApiTicketStatus =
  | "GENERATED"
  | "SENT"
  | "FOR_RESALE"
  | "USED"
  | "CANCELLED"
  | "REFUNDED";

export interface ApiTicket {
  id: string;
  reference: string;
  order_id: string;
  event_id: string;
  event_name: string;
  event_start_at: string;
  event_venue_name: string;
  event_venue_address: string;
  event_city: string;
  ticket_category_name: string;
  unit_price_ttc: number;
  status: ApiTicketStatus;
  holder_first_name: string;
  holder_last_name: string;
  buyer_email: string;
  qr_code_url: string | null;
  pdf_url: string | null;
  created_at: string;
}

export function getTicketsByOrder(orderId: string): Promise<ApiTicket[]> {
  return apiGet<ApiTicket[]>(`/tickets/order/${orderId}`);
}

export function getTicket(id: string): Promise<ApiTicket> {
  return apiGet<ApiTicket>(`/tickets/${id}`);
}

// Prix plafonné à la valeur faciale du billet — vérifié aussi côté serveur
// (backend/ticket-service/src/resale/ticket-resale.service.ts).
export function requestResale(
  ticketId: string,
  originalOrderId: string,
  resalePrice: number,
): Promise<unknown> {
  return apiPost(`/tickets/${ticketId}/request-resale`, {
    original_order_id: originalOrderId,
    resale_price: resalePrice,
  });
}
