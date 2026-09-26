import { ClientProxy } from "@nestjs/microservices";

/** Billet tel que renvoyé par le ticket-service (champs utiles au PDF et aux emails). */
export interface TicketPdfSource {
  id: string;
  reference: string;
  order_id: string;
  event_name: string;
  event_start_at: string;
  event_venue_name: string;
  event_venue_address: string;
  event_city: string;
  event_poster_url?: string;
  artist_name: string;
  ticket_category_name: string;
  unit_price_ttc: number | string;
  seat_info?: string;
  holder_first_name: string;
  holder_last_name: string;
  buyer_email: string;
}

/** (Re)génère le PDF d'un billet au nom de son titulaire actuel (pdf-service). */
export function emitTicketPdf(pdfClient: ClientProxy, ticket: TicketPdfSource): void {
  pdfClient.emit("pdf.generate_ticket", {
    ticket_id: ticket.id,
    reference: ticket.reference,
    order_id: ticket.order_id,
    event_name: ticket.event_name,
    event_start_at: ticket.event_start_at,
    event_venue_name: ticket.event_venue_name,
    event_venue_address: ticket.event_venue_address,
    event_city: ticket.event_city,
    event_poster_url: ticket.event_poster_url,
    artist_name: ticket.artist_name,
    ticket_category_name: ticket.ticket_category_name,
    // Colonne decimal renvoyée en string : le DTO du pdf-service exige un nombre.
    unit_price_ttc: Number(ticket.unit_price_ttc),
    seat_info: ticket.seat_info,
    holder_first_name: ticket.holder_first_name,
    holder_last_name: ticket.holder_last_name,
    buyer_email: ticket.buyer_email,
  });
}

/** Date d'événement lisible dans un email (« samedi 24 octobre 2026 »). */
export function formatEventDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
