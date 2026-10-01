// Filtres du catalogue : état, traduction en paramètres d'API, libellés et
// synchronisation avec l'URL (lien partageable, retour arrière conservé).

import type { ListEventsParams } from "@/lib/api/events";
import { dayMonth as shortDate } from "@/lib/format/dates";

export type WhenFilter = "all" | "today" | "tomorrow" | "weekend" | "week" | "month" | "custom";
export type PriceFilter = "all" | "free" | "custom";
export type SortOrder = "date" | "recent" | "price_asc" | "price_desc";

export interface CatalogueFilters {
  q: string;
  city: string;
  category: string; // code du référentiel, "" = toutes
  when: WhenFilter;
  from: string; // AAAA-MM-JJ (période personnalisée)
  to: string;
  price: PriceFilter;
  minPrice: string;
  maxPrice: string;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: CatalogueFilters = {
  q: "",
  city: "",
  category: "",
  when: "all",
  from: "",
  to: "",
  price: "all",
  minPrice: "",
  maxPrice: "",
  sort: "date",
};

export const WHEN_OPTIONS: { id: WhenFilter; label: string }[] = [
  { id: "all", label: "Toutes les dates" },
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois-ci" },
  { id: "custom", label: "Choisir des dates" },
];

export const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "date", label: "Date la plus proche" },
  { id: "recent", label: "Nouveautés" },
  { id: "price_asc", label: "Prix croissant" },
  { id: "price_desc", label: "Prix décroissant" },
];

export const RADIUS_OPTIONS_KM = [5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 25;
/** Choix « Plus de X km » (X = plus grand rayon proposé) : au-delà de cette distance. */
export const BEYOND_MAX_RADIUS = -1;
export const MAX_RADIUS_KM = RADIUS_OPTIONS_KM[RADIUS_OPTIONS_KM.length - 1];

/** « À moins de 25 km » ou « Plus de 100 km ». */
export function distanceLabel(radiusKm: number): string {
  return radiusKm === BEYOND_MAX_RADIUS ? `Plus de ${MAX_RADIUS_KM} km` : `À moins de ${radiusKm} km`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** Période couverte par le filtre de date. Le début n'est jamais dans le passé. */
export function dateRange(filters: CatalogueFilters, now = new Date()): { from: Date; to: Date | null } {
  const day = now.getDay(); // 0 = dimanche
  switch (filters.when) {
    case "today":
      return { from: now, to: endOfDay(now) };
    case "tomorrow":
      return { from: startOfDay(addDays(now, 1)), to: endOfDay(addDays(now, 1)) };
    case "weekend": {
      if (day === 0) return { from: now, to: endOfDay(now) };
      const saturday = day === 6 ? now : startOfDay(addDays(now, 6 - day));
      return { from: saturday, to: endOfDay(addDays(now, 7 - day)) };
    }
    case "week":
      return { from: now, to: endOfDay(addDays(now, day === 0 ? 0 : 7 - day)) };
    case "month":
      return { from: now, to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "custom": {
      const from = parseDay(filters.from);
      const to = parseDay(filters.to);
      return { from: from && from > now ? from : now, to: to ? endOfDay(to) : null };
    }
    default:
      return { from: now, to: null };
  }
}

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Bornes des périodes prédéfinies du filtre Date (« Choisir des dates »
 * exclu), pour en compter les événements.
 */
export function presetPeriods(now = new Date()): Array<{ key: WhenFilter; from: string; to?: string }> {
  return WHEN_OPTIONS.filter((option) => option.id !== "custom").map((option) => {
    const { from, to } = dateRange({ ...DEFAULT_FILTERS, when: option.id }, now);
    return { key: option.id, from: from.toISOString(), ...(to ? { to: to.toISOString() } : {}) };
  });
}

export function toApiParams(filters: CatalogueFilters): ListEventsParams {
  const { from, to } = dateRange(filters);
  return {
    q: filters.q.trim() || undefined,
    city: filters.city.trim() || undefined,
    category: filters.category || undefined,
    date_from: from.toISOString(),
    date_to: to?.toISOString(),
    ...(filters.price === "free" ? { max_price: 0 } : {}),
    ...(filters.price === "custom" ? { min_price: toNumber(filters.minPrice), max_price: toNumber(filters.maxPrice) } : {}),
    sort: filters.sort,
  };
}

export function whenLabel(filters: CatalogueFilters): string {
  if (filters.when === "custom") {
    const from = parseDay(filters.from);
    const to = parseDay(filters.to);
    if (from && to) return `Du ${shortDate.format(from)} au ${shortDate.format(to)}`;
    if (from) return `À partir du ${shortDate.format(from)}`;
    if (to) return `Jusqu'au ${shortDate.format(to)}`;
  }
  return WHEN_OPTIONS.find((option) => option.id === filters.when)?.label ?? "Toutes les dates";
}

export function priceLabel(filters: CatalogueFilters): string {
  if (filters.price === "free") return "Gratuit";
  if (filters.price === "custom") {
    const min = toNumber(filters.minPrice);
    const max = toNumber(filters.maxPrice);
    if (min !== undefined && max !== undefined) return `${min} € – ${max} €`;
    if (min !== undefined) return `À partir de ${min} €`;
    if (max !== undefined) return `Jusqu'à ${max} €`;
  }
  return "Tous les prix";
}

// ─── URL ────────────────────────────────────────────────────────────────────

const URL_KEYS: Record<keyof CatalogueFilters, string> = {
  q: "q",
  city: "ville",
  category: "categorie",
  when: "quand",
  from: "du",
  to: "au",
  price: "prix",
  minPrice: "min",
  maxPrice: "max",
  sort: "tri",
};

export function filtersFromUrl(search: string): CatalogueFilters {
  const params = new URLSearchParams(search);
  const filters = { ...DEFAULT_FILTERS };
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof CatalogueFilters, string][]) {
    const value = params.get(key);
    if (value !== null) (filters as Record<string, string>)[field] = value;
  }
  if (!WHEN_OPTIONS.some((option) => option.id === filters.when)) filters.when = "all";
  if (!["all", "free", "custom"].includes(filters.price)) filters.price = "all";
  if (!SORT_OPTIONS.some((option) => option.id === filters.sort)) filters.sort = "date";
  return filters;
}

export function filtersToUrl(filters: CatalogueFilters): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(URL_KEYS) as [keyof CatalogueFilters, string][]) {
    const value = filters[field];
    if (value && value !== DEFAULT_FILTERS[field]) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
