// Données de démonstration pour la page profil — aucun appel API,
// à remplacer par les vraies données (user-service / order-service /
// ticket-service / auth-service) lors du câblage.

export const profileUser = {
  initials: "AD",
  name: "Adama Diawara",
  email: "diawaraad97@gmail.com",
  memberSince: "mai 2026",
  roles: ["Acheteur", "Organisateur"] as const,
};

// "for_resale"/"cancelled" ajoutés pour représenter fidèlement les statuts
// réels de ticket-service (FOR_RESALE/CANCELLED/REFUNDED) sur la page profil
// câblée — "valid"/"used" restent les seuls statuts utilisés par les données
// de démonstration ci-dessous.
export type TicketStatus = "valid" | "used" | "for_resale" | "cancelled";

export interface ProfileTicket {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  emoji: string;
  iconBg: string;
  status: TicketStatus;
  // Billet reçu en cadeau : « Reçu de Jean D. »
  receivedFromLabel?: string;
  // Billet acheté en revente : « Acheté en revente le 26 septembre 2026 »
  resalePurchaseLabel?: string;
}

export const profileTickets: ProfileTicket[] = [
  {
    id: "nuit-electronique-standard",
    title: "Nuit Électronique — Standard",
    dateLabel: "15 août 2026",
    venue: "La Défense Arena",
    emoji: "🎧",
    iconBg: "bg-blue-500/15",
    status: "valid",
  },
  {
    id: "psg-ol-tribune-sud",
    title: "PSG vs Olympique Lyonnais — Tribune Sud",
    dateLabel: "5 sept. 2026",
    venue: "Parc des Princes",
    emoji: "⚽",
    iconBg: "bg-rose-500/15",
    status: "valid",
  },
  {
    id: "romeo-juliette-orchestre",
    title: "Roméo & Juliette — Orchestre",
    dateLabel: "12 juin 2026",
    venue: "Comédie-Française",
    emoji: "🎭",
    iconBg: "bg-amber-500/15",
    status: "used",
  },
];

export const allProfileTickets: ProfileTicket[] = [
  ...profileTickets,
  {
    id: "festival-idf-inscription",
    title: "Festival Île de France — Inscription",
    dateLabel: "30 août 2026",
    venue: "Bois de Vincennes",
    emoji: "🌲",
    iconBg: "bg-emerald-500/15",
    status: "valid",
  },
  {
    id: "jazz-saint-germain-standard",
    title: "Jazz à Saint-Germain — Standard",
    dateLabel: "10 sept. 2026",
    venue: "Caveau de la Huchette",
    emoji: "🎷",
    iconBg: "bg-sky-500/15",
    status: "used",
  },
];

// "pending"/"cancelled"/"refunded" ajoutés pour représenter fidèlement les
// statuts réels d'order-service (PENDING_PAYMENT/CANCELLED/REFUNDED) sur la
// page profil câblée — "sent"/"used" restent les seuls statuts utilisés par
// les données de démonstration ci-dessous.
export type OrderStatus = "sent" | "used" | "pending" | "cancelled" | "refunded";

export interface ProfileOrder {
  // Présent uniquement pour une vraie commande (id réel order-service) —
  // absent pour les données de démonstration, qui restent liées par référence.
  id?: string;
  reference: string;
  amountLabel: string;
  dateLabel: string;
  ticketCountLabel: string;
  status: OrderStatus;
}

export const profileOrders: ProfileOrder[] = [
  {
    reference: "ORD-2026-00847",
    amountLabel: "56,75 €",
    dateLabel: "Passée le 8 juillet 2026",
    ticketCountLabel: "2 billets",
    status: "sent",
  },
  {
    reference: "ORD-2026-00412",
    amountLabel: "55,00 €",
    dateLabel: "Passée le 2 mai 2026",
    ticketCountLabel: "1 billet",
    status: "used",
  },
];

export const ticketStatusBadge: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  valid: {
    label: "✓ Valide",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  used: {
    label: "Utilisé",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  for_resale: {
    label: "En revente",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
  },
};

export const orderStatusBadge: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  sent: {
    label: "Billets envoyés",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  used: {
    label: "Utilisé",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  pending: {
    label: "Paiement en attente",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
  },
  refunded: {
    label: "Remboursée",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
};

export const profileSecurity = {
  twoFactor: {
    enabled: true,
    method: "Via application TOTP (Google Authenticator)",
  },
  password: {
    updatedLabel: "Modifié il y a 30 jours",
  },
};
