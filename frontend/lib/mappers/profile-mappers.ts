// Convertit les données réelles (order-service/ticket-service) vers les
// formes attendues par les composants profil existants (Panel/TicketRow/
// OrderRow), construits à l'origine pour les données de démonstration.

import type { ApiOrder, ApiOrderItem, ApiPaymentMethod } from "@/lib/api/orders";
import type { ApiTicket, ApiTicketStatus } from "@/lib/api/tickets";
import type { ProfileOrder, ProfileTicket, TicketStatus, OrderStatus } from "@/lib/mock/profile";
import type { TicketDetail } from "@/lib/mock/ticket-detail";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function ticketStatusFor(status: ApiTicketStatus): TicketStatus {
  switch (status) {
    case "USED":
      return "used";
    case "FOR_RESALE":
      return "for_resale";
    case "CANCELLED":
    case "REFUNDED":
      return "cancelled";
    case "GENERATED":
    case "SENT":
    default:
      return "valid";
  }
}

export function apiTicketToProfileTicket(ticket: ApiTicket): ProfileTicket {
  return {
    id: ticket.id,
    title: `${ticket.event_name} — ${ticket.ticket_category_name}`,
    dateLabel: dateFormatter.format(new Date(ticket.event_start_at)),
    venue: `${ticket.event_venue_name}, ${ticket.event_city}`,
    emoji: "🎫",
    iconBg: "bg-blue-500/15",
    status: ticketStatusFor(ticket.status),
    receivedFromLabel: ticket.received_from
      ? `Reçu de ${ticket.received_from.first_name} ${ticket.received_from.last_name.charAt(0)}.`
      : undefined,
    resalePurchaseLabel: ticket.resale_purchase
      ? `Acheté en revente${ticket.resale_purchase.at ? ` le ${dateFormatter.format(new Date(ticket.resale_purchase.at))}` : ""}`
      : undefined,
  };
}

export function orderStatusFor(status: ApiOrder["status"]): OrderStatus {
  switch (status) {
    case "PENDING_PAYMENT":
      return "pending";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
    case "TICKETS_SENT":
    case "CONFIRMED":
    default:
      return "sent";
  }
}

export function apiTicketToDetail(ticket: ApiTicket): TicketDetail {
  const start = new Date(ticket.event_start_at);
  return {
    id: ticket.id,
    reference: ticket.reference,
    eventName: ticket.event_name,
    venueName: ticket.event_venue_name,
    address: ticket.event_venue_address,
    city: ticket.event_city,
    dateLabel: dateFormatter.format(start),
    timeLabel: timeFormatter.format(start),
    holderName: `${ticket.holder_first_name} ${ticket.holder_last_name}`,
    buyerEmail: ticket.buyer_email,
    categoryName: ticket.ticket_category_name,
    priceLabel: Number(ticket.unit_price_ttc) === 0 ? "Gratuit" : currency.format(Number(ticket.unit_price_ttc)),
    // Bug corrigé : ne distinguait que "used"/"valid" — un billet en revente
    // (FOR_RESALE) ou annulé/remboursé s'affichait comme parfaitement valide,
    // y compris le bouton "Revendre ce billet" sur un billet déjà en vente.
    status: ticketStatusFor(ticket.status),
    emoji: "🎫",
    band: "bg-slate-800",
    pdfUrl: ticket.pdf_url ?? undefined,
    unitPriceTtc: Number(ticket.unit_price_ttc),
    orderId: ticket.order_id,
    receivedFrom: ticket.received_from
      ? {
          name: `${ticket.received_from.first_name} ${ticket.received_from.last_name}`,
          email: ticket.received_from.email,
          dateLabel: dateFormatter.format(new Date(ticket.received_from.at)),
        }
      : undefined,
    resalePurchase: ticket.resale_purchase
      ? {
          dateLabel: ticket.resale_purchase.at ? dateFormatter.format(new Date(ticket.resale_purchase.at)) : "—",
          priceLabel: currency.format(ticket.resale_purchase.price),
        }
      : undefined,
  };
}

export function apiOrderToProfileOrder(order: ApiOrder, ticketCount: number): ProfileOrder {
  return {
    id: order.id,
    reference: order.reference,
    amountLabel: currency.format(Number(order.total_amount_ttc)),
    dateLabel: `Passée le ${dateFormatter.format(new Date(order.created_at))}`,
    ticketCountLabel: ticketCount > 1 ? `${ticketCount} billets` : `${ticketCount} billet`,
    status: orderStatusFor(order.status),
  };
}

const paymentMethodLabels: Record<ApiPaymentMethod, string> = {
  STRIPE: "Carte bancaire",
  PAYPAL: "PayPal",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
};

export function apiOrderItemsToLines(items: ApiOrderItem[]): { label: string; amount: number }[] {
  return items.map((item) => ({
    label: `${item.quantity}× ${item.ticket_category_name}`,
    amount: Number(item.total_price_ttc),
  }));
}

export function paymentMethodLabel(method: ApiPaymentMethod): string {
  return paymentMethodLabels[method] ?? method;
}
