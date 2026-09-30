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
  /** Places restantes ; 0 = catégorie complète, réservation désactivée. */
  remaining?: number;
  /** Nombre maximum de billets de cette catégorie par commande. */
  maxPerOrder?: number;
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
  /** Pavé calendrier de l'en-tête : "sam.", "17", "oct." (fuseau de l'événement). */
  calendar?: { weekday: string; day: string; month: string };
  /** Ex. "samedi 17 octobre 2026" */
  longDateLabel?: string;
  /** Début de l'événement (ISO) — compte à rebours de l'en-tête. */
  startAt?: string;
  /** Ville seule (le nom du lieu est dans venueName). */
  venueCity?: string;
  /** Prix TTC le plus bas des billets en vente, null s'il n'y en a aucun. */
  fromPrice?: number | null;
  /** Places encore disponibles, toutes catégories confondues. */
  remaining?: number;
}

