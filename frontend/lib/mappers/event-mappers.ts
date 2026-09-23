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
    city: `${event.venue_name}, ${event.venue_city}`,
    remainingLabel: `${totalRemaining} places restantes`,
    statusLabel: "Validé",
    heroEmoji: meta.emoji,
    band: meta.band,
    description: event.description,
    accessConditions: event.access_conditions ?? "Aucune condition d'accès particulière.",
    tickets,
  };
}
