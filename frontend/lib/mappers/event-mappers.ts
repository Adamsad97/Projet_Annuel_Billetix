import type { ApiCategory } from "@/lib/api/categories";
import type { ApiEvent, ApiTicketCategory } from "@/lib/api/events";
import { apiCategoryMeta } from "@/lib/constants/events";
import type { EventDetail, TicketOption } from "@/lib/constants/event-details";
import { euros as currency } from "@/lib/format/money";
import type { Locale } from "@/lib/i18n/config";
import { dateFormat } from "@/lib/i18n/intl";
import { activeLocale, translate, type TranslateVars } from "@/lib/i18n/translate";

// Les pages serveur passent leur langue ; dans le navigateur, celle du site.
const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };

function lowestPrice(categories: ApiTicketCategory[]): number | null {
  const activePrices = categories
    .filter((c) => c.is_active)
    .map((c) => Number(c.price_ttc));
  if (activePrices.length === 0) return null;
  return Math.min(...activePrices);
}

/** Libellé et emoji depuis le référentiel admin, la table figée en dernier recours. */
function categoryDisplay(code: string, referential: ApiCategory[]): { label: string; emoji: string } {
  const meta = apiCategoryMeta[code] ?? apiCategoryMeta.AUTRE;
  const category = referential.find((c) => c.code === code);
  return { label: category?.label ?? meta.label, emoji: category?.emoji || meta.emoji };
}

/** Mention sur le visuel : ventes suspendues, complet ou dernières places. */
function availabilityBadge(event: ApiEvent, categories: ApiTicketCategory[], locale: Locale): string | null {
  if (event.status === "SUSPENDED") return translate(locale, "Ventes suspendues");
  const totalRemaining = categories.reduce((sum, c) => sum + c.remaining_quota, 0);
  const totalQuota = categories.reduce((sum, c) => sum + c.quota, 0);
  if (totalQuota > 0 && totalRemaining === 0) return translate(locale, "Complet");
  if (totalQuota > 0 && totalRemaining / totalQuota < 0.1) return remainingPlaces(totalRemaining, locale);
  return null;
}

function remainingPlaces(count: number, locale: Locale): string {
  return count === 1 ? translate(locale, "1 place restante") : translate(locale, "{count} places restantes", { count });
}

// Heure dans le fuseau du lieu de l'événement, pas celui du serveur.
function formatInZone(isoDate: string, timeZone: string, options: Intl.DateTimeFormatOptions, locale: Locale): string {
  try {
    return dateFormat({ ...options, timeZone }, locale).format(new Date(isoDate));
  } catch {
    return dateFormat(options, locale).format(new Date(isoDate)); // fuseau inconnu
  }
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/** Jour calendaire (« 2026-10-01 ») dans le fuseau de l'événement. */
function dayKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}

/** « Aujourd'hui », « Demain », « Ce week-end » ou date complète, dans le fuseau de l'événement. */
function formatFeaturedDate(isoDate: string, timeZone: string, locale: Locale, now = new Date()): string {
  const tr = (text: string, vars?: TranslateVars) => translate(locale, text, vars);
  const start = new Date(isoDate);
  const hour = formatInZone(isoDate, timeZone, TIME, locale);
  const toUtcDay = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86_400_000;
  const days = toUtcDay(dayKey(start, timeZone)) - toUtcDay(dayKey(now, timeZone));
  if (days === 0) return tr("Aujourd'hui · {hour}", { hour });
  if (days === 1) return tr("Demain · {hour}", { hour });
  const weekday = new Date(`${dayKey(start, timeZone)}T00:00:00Z`).getUTCDay();
  const todayWeekday = new Date(`${dayKey(now, timeZone)}T00:00:00Z`).getUTCDay();
  const daysToSunday = (7 - todayWeekday) % 7;
  if (days > 1 && days <= daysToSunday && (weekday === 6 || weekday === 0)) {
    return tr("Ce week-end · {day} {hour}", { day: formatInZone(isoDate, timeZone, { weekday: "short" }, locale), hour });
  }
  return formatInZone(isoDate, timeZone, { ...SHORT_DATE, ...TIME }, locale);
}

/** Carte du carrousel « À la une » (affiche en grand + pastilles d'infos). */
export interface FeaturedEvent {
  id: string;
  slug: string | null;
  title: string;
  venueName: string;
  city: string;
  country: string;
  posterUrl: string | null;
  /** Couverture horizontale : remplit tout le visuel de la carte. */
  coverUrl: string | null;
  /** Ex. "10 oct. 2026, 14:00" */
  dateLabel: string;
  /** null tant qu'aucune catégorie de billet active n'existe. */
  isFree: boolean | null;
  /** « Gratuit », « Dès 42,00 € » ; null sans billet en vente. */
  priceLabel: string | null;
  /** « Complet », « 5 places restantes », « Ventes suspendues ». */
  badge: string | null;
  /** Code de catégorie (libellé du référentiel admin, côté catalogue). */
  categoryCode: string;
  categoryLabel: string;
  categoryEmoji: string;
  band: string;
  /** Ventes suspendues par l'administration : message affiché sur la carte. */
  suspendedNotice: string | null;
  /** Coordonnées du lieu, pour la distance depuis la position du visiteur. */
  latitude: number | null;
  longitude: number | null;
}

export function apiEventToFeatured(
  event: ApiEvent,
  categories: ApiTicketCategory[],
  referential: ApiCategory[] = [],
  locale: Locale = activeLocale(),
): FeaturedEvent {
  const tr = (text: string, vars?: TranslateVars) => translate(locale, text, vars);
  const meta = apiCategoryMeta[event.category] ?? apiCategoryMeta.AUTRE;
  const display = categoryDisplay(event.category, referential);
  const min = lowestPrice(categories);
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    venueName: event.venue_name,
    city: event.venue_city,
    country: event.venue_country,
    posterUrl: event.poster_url,
    coverUrl: event.cover_url ?? null,
    dateLabel: formatFeaturedDate(event.start_date, event.timezone, locale),
    isFree: min === null ? null : min === 0,
    priceLabel: min === null ? null : min === 0 ? tr("Gratuit") : tr("Dès {value}", { value: currency.format(min, locale) }),
    badge: availabilityBadge(event, categories, locale),
    categoryCode: event.category,
    categoryLabel: tr(display.label),
    categoryEmoji: display.emoji,
    band: meta.band,
    suspendedNotice: event.status === "SUSPENDED" ? event.suspension_reason ?? "" : null,
    latitude: event.venue_latitude !== null ? Number(event.venue_latitude) : null,
    longitude: event.venue_longitude !== null ? Number(event.venue_longitude) : null,
  };
}

/** Événement réel et ses catégories → détail complet pour la page /evenements/[id]. */
export function apiEventToDetail(
  event: ApiEvent,
  categories: ApiTicketCategory[],
  referential: ApiCategory[] = [],
  locale: Locale = activeLocale(),
): EventDetail {
  const tr = (text: string, vars?: TranslateVars) => translate(locale, text, vars);
  const inZone = (iso: string, options: Intl.DateTimeFormatOptions) => formatInZone(iso, event.timezone, options, locale);
  const meta = apiCategoryMeta[event.category] ?? apiCategoryMeta.AUTRE;
  const display = categoryDisplay(event.category, referential);
  const start = new Date(event.start_date);
  const totalRemaining = categories.reduce((sum, c) => sum + c.remaining_quota, 0);

  const tickets: TicketOption[] = categories
    .filter((c) => c.is_active && c.visibility === "PUBLIC")
    .map((c) => ({
      id: c.id,
      label: c.name,
      // Prix payé par le client (TVA incluse) — le HT sert au détail de la TVA.
      price: Number(c.price_ttc),
      priceHt: Number(c.price_ht),
      remaining: c.remaining_quota,
      maxPerOrder: c.max_per_order,
    }));

  const addressParts = [event.venue_address_line1, event.venue_address_line2].filter(Boolean);

  return {
    id: event.id,
    categoryLabel: tr(display.label),
    categoryEmoji: display.emoji,
    title: event.title,
    venueName: event.venue_name,
    dateLabel: `${dateFormat(FULL_DATE, locale).format(start)} — ${dateFormat(TIME, locale).format(start)}`,
    address: `${addressParts.join(", ")}, ${event.venue_postal_code} ${event.venue_city}`,
    latitude: event.venue_latitude !== null ? Number(event.venue_latitude) : null,
    longitude: event.venue_longitude !== null ? Number(event.venue_longitude) : null,
    city: `${event.venue_name}, ${event.venue_city}`,
    salesStartAt: event.sales_start_date,
    salesEndAt: event.sales_end_date,
    remainingLabel: remainingPlaces(totalRemaining, locale),
    statusLabel: tr("Validé"),
    heroEmoji: display.emoji,
    band: meta.band,
    description: event.description,
    accessConditions: event.access_conditions ?? tr("Aucune condition d'accès particulière."),
    tickets,
    posterUrl: event.poster_url,
    dateRangeLabel: (() => {
      const from = inZone(event.start_date, SHORT_DATE);
      const to = inZone(event.end_date, SHORT_DATE);
      return from === to ? from : `${from} → ${to}`;
    })(),
    timeRangeLabel: tr("de {start} à {end}", { start: inZone(event.start_date, TIME), end: inZone(event.end_date, TIME) }),
    calendar: {
      weekday: inZone(event.start_date, { weekday: "short" }),
      day: inZone(event.start_date, { day: "numeric" }),
      month: inZone(event.start_date, { month: "short" }),
    },
    longDateLabel: inZone(event.start_date, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    startAt: event.start_date,
    venueCity: event.venue_city,
    fromPrice: tickets.length > 0 ? Math.min(...tickets.map((t) => t.price)) : null,
    // Places en vente au public (hors catégories masquées ou désactivées).
    remaining: tickets.reduce((sum, t) => sum + (t.remaining ?? 0), 0),
  };
}
