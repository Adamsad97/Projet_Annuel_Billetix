import type { ApiEvent, ApiTicketCategory } from "@/lib/api/events";
import { apiCategoryMeta, type MockEvent } from "@/lib/mock/events";
import type { EventDetail, TicketOption } from "@/lib/mock/event-details";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" });
const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function lowestPrice(categories: ApiTicketCategory[]): number | null {
  const activePrices = categories
    .filter((c) => c.is_active)
    .map((c) => Number(c.price_ht));
  if (activePrices.length === 0) return null;
  return Math.min(...activePrices);
}

/**
 * Convertit un événement réel + ses catégories de billets (déjà chargées,
 * cf. N+1 assumé côté catalogue pour un affichage honnête du prix) en
 * carte affichable par <EventCard>.
 */
export function apiEventToCard(event: ApiEvent, categories: ApiTicketCategory[]): MockEvent {
  const meta = apiCategoryMeta[event.category] ?? apiCategoryMeta.AUTRE;
  const start = new Date(event.start_date);
  const min = lowestPrice(categories);
  const isFree = min !== null && min === 0;

  const totalRemaining = categories.reduce((sum, c) => sum + c.remaining_quota, 0);
  const totalQuota = categories.reduce((sum, c) => sum + c.quota, 0);
  let badge: string | undefined;
  if (totalQuota > 0 && totalRemaining === 0) {
    badge = "Complet";
  } else if (totalQuota > 0 && totalRemaining / totalQuota < 0.1) {
    badge = `${totalRemaining} places restantes`;
  }

  return {
    id: event.id,
    day: dayFormatter.format(start),
    month: monthFormatter.format(start).replace(".", "."),
    title: event.title,
    subtitle: event.venue_name,
    city: event.venue_city,
    emoji: meta.emoji,
    band: meta.band,
    badge,
    category: meta.label,
    priceLabel: isFree
      ? "Gratuit"
      : min !== null
        ? `À partir de ${currency.format(min)}`
        : "Tarifs à venir",
    free: isFree,
  };
}

// Heure du lieu de l'événement (event.timezone), pas celle du serveur qui
// rend la page (UTC en conteneur) — sinon "14:00" à Conakry s'afficherait
// selon le fuseau du rendu.
function formatInZone(isoDate: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone }).format(new Date(isoDate));
  } catch {
    return new Intl.DateTimeFormat("fr-FR", options).format(new Date(isoDate)); // fuseau inconnu
  }
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

function formatFeaturedDate(isoDate: string, timeZone: string): string {
  return formatInZone(isoDate, timeZone, { ...SHORT_DATE, ...TIME });
}

/** Carte du carrousel « À la une » (affiche en grand + pastilles d'infos). */
export interface FeaturedEvent {
  id: string;
  title: string;
  venueName: string;
  city: string;
  country: string;
  posterUrl: string | null;
  /** Ex. "10 oct. 2026, 14:00" */
  dateLabel: string;
  /** null tant qu'aucune catégorie de billet active n'existe. */
  isFree: boolean | null;
  categoryLabel: string;
  categoryEmoji: string;
  band: string;
}

export function apiEventToFeatured(event: ApiEvent, categories: ApiTicketCategory[]): FeaturedEvent {
  const meta = apiCategoryMeta[event.category] ?? apiCategoryMeta.AUTRE;
  const min = lowestPrice(categories);
  return {
    id: event.id,
    title: event.title,
    venueName: event.venue_name,
    city: event.venue_city,
    country: event.venue_country,
    posterUrl: event.poster_url,
    dateLabel: formatFeaturedDate(event.start_date, event.timezone),
    isFree: min === null ? null : min === 0,
    categoryLabel: meta.label,
    categoryEmoji: meta.emoji,
    band: meta.band,
  };
}

/**
 * Convertit un événement réel + ses catégories en détail complet pour la
 * page /evenements/[id].
 */
export function apiEventToDetail(event: ApiEvent, categories: ApiTicketCategory[]): EventDetail {
  const meta = apiCategoryMeta[event.category] ?? apiCategoryMeta.AUTRE;
  const start = new Date(event.start_date);
  const totalRemaining = categories.reduce((sum, c) => sum + c.remaining_quota, 0);

  const tickets: TicketOption[] = categories
    .filter((c) => c.is_active && c.visibility === "PUBLIC")
    .map((c) => ({
      id: c.id,
      label: c.name,
      price: Number(c.price_ht),
    }));

  const addressParts = [event.venue_address_line1, event.venue_address_line2].filter(Boolean);

  return {
    id: event.id,
    categoryLabel: meta.label,
    categoryEmoji: meta.emoji,
    title: event.title,
    venueName: event.venue_name,
    dateLabel: `${fullDateFormatter.format(start)} — ${timeFormatter.format(start)}`,
    address: `${addressParts.join(", ")}, ${event.venue_postal_code} ${event.venue_city}`,
    latitude: event.venue_latitude !== null ? Number(event.venue_latitude) : null,
    longitude: event.venue_longitude !== null ? Number(event.venue_longitude) : null,
    city: `${event.venue_name}, ${event.venue_city}`,
    salesStartAt: event.sales_start_date,
    salesEndAt: event.sales_end_date,
    remainingLabel: `${totalRemaining} places restantes`,
    statusLabel: "Validé",
    heroEmoji: meta.emoji,
    band: meta.band,
    description: event.description,
    accessConditions: event.access_conditions ?? "Aucune condition d'accès particulière.",
    tickets,
    posterUrl: event.poster_url,
    dateRangeLabel: (() => {
      const from = formatInZone(event.start_date, event.timezone, SHORT_DATE);
      const to = formatInZone(event.end_date, event.timezone, SHORT_DATE);
      return from === to ? from : `${from} → ${to}`;
    })(),
    timeRangeLabel: `de ${formatInZone(event.start_date, event.timezone, TIME)} à ${formatInZone(event.end_date, event.timezone, TIME)}`,
  };
}
