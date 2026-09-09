// Convertit un billet réel (ApiTicket, ticket-service via
// GET /events/:id/attendees) vers la forme attendue par AttendeeRow,
// construit à l'origine pour des données de démonstration.

import type { ApiTicket } from "@/lib/api/tickets";

export interface Attendee {
  id: string;
  name: string;
  email: string;
  category: string;
  status: "used" | "pending" | "cancelled";
  purchasedLabel: string;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function apiTicketToAttendee(ticket: ApiTicket): Attendee {
  let status: Attendee["status"] = "pending";
  if (ticket.status === "USED") status = "used";
  else if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") status = "cancelled";

  return {
    id: ticket.id,
    name: `${ticket.holder_first_name} ${ticket.holder_last_name}`,
    email: ticket.buyer_email,
    category: ticket.ticket_category_name,
    status,
    purchasedLabel: dateFormatter.format(new Date(ticket.created_at)),
  };
}
