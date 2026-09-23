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
  city: string;
  remainingLabel: string;
  statusLabel: string;
  heroEmoji: string;
  band: string;
  description: string;
  lineup?: string;
  accessConditions: string;
  tickets: TicketOption[];
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
    city: "La Défense Arena, Puteaux",
    remainingLabel: "1 200 places restantes",
    statusLabel: "Validé",
    heroEmoji: "🎵",
    band: "from-violet-700 via-purple-800 to-indigo-950",
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
