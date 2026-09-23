// Détail complet d'une commande — aucun appel API, à remplacer par les
// vraies données (order-service) lors du câblage.

export interface OrderDetailLine {
  label: string;
  amount: number;
}

export interface OrderDetail {
  reference: string;
  dateLabel: string;
  status: "sent" | "used";
  paymentMethodLabel: string;
  lines: OrderDetailLine[];
  ticketIds: string[];
}

export const orderDetails: Record<string, OrderDetail> = {
  "ORD-2026-00847": {
    reference: "ORD-2026-00847",
    dateLabel: "8 juillet 2026",
    status: "sent",
    paymentMethodLabel: "Carte bancaire •••• 4242",
    lines: [
      { label: "2× Early Bird — Nuit Électronique", amount: 50.0 },
      { label: "Frais de service (10%)", amount: 5.0 },
      { label: "Frais Stripe", amount: 1.75 },
    ],
    ticketIds: ["nuit-electronique-standard"],
  },
  "ORD-2026-00412": {
    reference: "ORD-2026-00412",
    dateLabel: "2 mai 2026",
    status: "used",
    paymentMethodLabel: "Carte bancaire •••• 4242",
    lines: [
      { label: "1× Tribune Sud — PSG vs Olympique Lyonnais", amount: 55.0 },
    ],
    ticketIds: ["psg-ol-tribune-sud"],
  },
};
