// Types d'affichage de la page détail d'un événement.

export interface TicketOption {
  id: string;
  label: string;
  // Prix TTC, celui affiché aux clients et payé.
  price: number;
  priceHt?: number;
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

