// Client pour les endpoints /tickets de l'api-gateway
// (backend/api-gateway/src/ticket/ticket.controller.ts). Câblage réel.

import { apiDownload, apiGet, apiPost } from "./client";

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
  pdf_url: string | null;
  created_at: string;
  // Billet reçu en cadeau : qui l'a offert (GET /tickets/mine et /tickets/:id).
  received_from?: ApiTransferParty | null;
  // Liste d'une commande : billet offert depuis à un autre compte.
  transferred?: boolean;
  // Billet acheté en revente : prix payé et date (GET /tickets/mine et /tickets/:id).
  resale_purchase?: { price: number; at: string | null } | null;
  // Liste d'une commande : billet revendu depuis (plus rattaché à cette commande).
  resold?: boolean;
  resale_price?: number;
  sold_at?: string | null;
}

/** Billet revendu : trace pour le vendeur (le billet n'est plus à lui). */
export interface ApiResoldTicket {
  id: string;
  ticket_reference: string | null;
  event_name: string | null;
  event_start_at: string;
  ticket_category_name: string | null;
  resale_price: number;
  listed_at: string;
  sold_at: string | null;
}

export interface ApiTransferParty {
  first_name: string;
  last_name: string;
  email: string;
  at: string;
}

/** Billet offert par l'utilisateur : trace figée, sans accès au billet. */
export interface ApiGivenTicket {
  id: string;
  ticket_reference: string;
  event_name: string;
  event_start_at: string;
  ticket_category_name: string;
  to_email: string;
  to_holder_first_name: string;
  to_holder_last_name: string;
  at: string;
  // REVERTED : transfert annulé par un admin, billet rendu.
  status: "ACTIVE" | "REVERTED";
  reverted_at: string | null;
  // Dernière demande d'annulation faite depuis la plateforme.
  revert_request: { status: "PENDING" | "APPROVED" | "REJECTED"; decision_reason: string | null; at: string } | null;
}

/** Billet reçu puis retiré (transfert annulé à la demande de l'expéditeur). */
export interface ApiWithdrawnTicket {
  id: string;
  ticket_reference: string;
  event_name: string;
  event_start_at: string;
  ticket_category_name: string;
  from_first_name: string;
  from_last_name: string;
  received_at: string;
  reverted_at: string | null;
}

/** Billets dont je suis titulaire, billets offerts et billets retirés. */
export function getMyTickets(): Promise<{
  tickets: ApiTicket[];
  given: ApiGivenTicket[];
  withdrawn: ApiWithdrawnTicket[];
  resold: ApiResoldTicket[];
}> {
  return apiGet(`/tickets/mine`);
}

/** L'expéditeur demande l'annulation d'un transfert (traitée par l'équipe BilleTix). */
export function requestTransferRevert(transferId: string, reason: string): Promise<{ success: true }> {
  return apiPost(`/tickets/transfers/${transferId}/revert-request`, { reason });
}

/**
 * Offre le billet à un autre compte BilleTix : transfert immédiat et
 * définitif. Erreur `REAUTH_REQUIRED` si la connexion n'est pas récente.
 */
export function giftTicket(
  ticketId: string,
  data: { recipient_email: string; holder_first_name: string; holder_last_name: string },
): Promise<{ success: true; transfer: { to_email: string; to_holder_first_name: string; to_holder_last_name: string; at: string } }> {
  return apiPost(`/tickets/${ticketId}/gift`, data);
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

/** PDF du billet, servi uniquement à son titulaire connecté. */
export function downloadTicketPdf(ticketId: string, reference: string): Promise<void> {
  return apiDownload(`/tickets/${ticketId}/pdf`, `billet-${reference}.pdf`);
}

/**
 * QR code d'un billet valide, à la demande du titulaire : image d'un code
 * éphémère (aucune donnée du billet). `refresh_in_seconds` : délai avant le
 * code suivant ; `refresh` : renouvellement pendant un même affichage (non
 * journalisé comme un nouvel accès).
 */
export function getTicketQr(
  ticketId: string,
  refresh = false,
): Promise<{ qr_code_url: string; display_seconds: number; refresh_in_seconds: number }> {
  return apiGet(`/tickets/${ticketId}/qr${refresh ? "?refresh=1" : ""}`);
}
