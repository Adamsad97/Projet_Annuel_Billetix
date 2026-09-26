// Données de démonstration pour la page détail événement — aucun appel API,
// à remplacer par le détail réel (event-service) lors du câblage.

export interface TicketOption {
  id: string;
  label: string;
  price: number;
  originalPrice?: number;
  tag?: string;
  defaultQuantity?: number;
}

export interface EventDetail {
  id: string;
  categoryLabel: string;
  categoryEmoji: string;
  title: string;
  venueName: string;
  dateLabel: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  city: string;
  salesStartAt: string;
  salesEndAt: string;
  remainingLabel: string;
  statusLabel: string;
  heroEmoji: string;
  band: string;
  description: string;
  lineup?: string;
  accessConditions: string;
  tickets: TicketOption[];
  // Page détail réelle (mapper) : absents des données de démonstration.
  posterUrl?: string | null;
  /** Ex. "17 oct. 2026 → 18 oct. 2026" (une seule date si même jour) */
  dateRangeLabel?: string;
  /** Ex. "de 14:00 à 23:00" */
  timeRangeLabel?: string;
}

export const eventDetails: Record<string, EventDetail> = {
  "nuit-electronique": {
    id: "nuit-electronique",
    categoryLabel: "Concert",
    categoryEmoji: "🎧",
    title: "Nuit Électronique",
    venueName: "La Défense Arena",
    dateLabel: "Samedi 15 août 2026 — 20h00",
    address: "2 Esplanade de la Défense, 92000 Puteaux",
    latitude: 48.8918,
    longitude: 2.2385,
    city: "La Défense Arena, Puteaux",
    salesStartAt: "2026-01-01T00:00:00.000Z",
    salesEndAt: "2026-08-15T18:00:00.000Z",
    remainingLabel: "1 200 places restantes",
    statusLabel: "Validé",
    heroEmoji: "🎵",
    band: "from-blue-700 via-purple-800 to-indigo-950",
    description:
      "Une soirée inoubliable au cœur de La Défense Arena avec les meilleurs DJs de la scène internationale. 6 heures de musique non-stop, lasers et ambiance unique.",
    lineup: "Martin Garrix · Amelie Lens · Charlotte de Witte",
    accessConditions:
      "Âge minimum : 18 ans · Pièce d'identité obligatoire · Remboursable jusqu'à J-7",
    tickets: [
      { id: "standard", label: "Standard", price: 35 },
      { id: "vip", label: "VIP", price: 85, tag: "Backstage" },
      {
        id: "early-bird",
        label: "Early Bird",
        price: 25,
        originalPrice: 35,
        defaultQuantity: 2,
      },
    ],
  },
};
