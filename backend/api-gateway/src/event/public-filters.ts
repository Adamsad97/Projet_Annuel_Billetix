/**
 * Filtres publics des événements lus dans l'adresse (?q=…&city=…), partagés
 * par la liste et par les nombres des filtres : les trois routes comprennent
 * toujours exactement les mêmes filtres. Validation fine par l'event-service.
 */
export type PublicFilterQuery = Record<string, string | undefined>;

const optionalNumber = (value: string | undefined) => (value === undefined || value === "" ? undefined : Number(value));

export function toPublicFilters(query: PublicFilterQuery) {
  return {
    category: query.category || undefined,
    city: query.city || undefined,
    q: query.q || undefined,
    min_price: optionalNumber(query.min_price),
    max_price: optionalNumber(query.max_price),
    lat: optionalNumber(query.lat),
    lng: optionalNumber(query.lng),
    radius_km: optionalNumber(query.radius_km),
    min_distance_km: optionalNumber(query.min_distance_km),
    featured: query.featured === "true" ? true : undefined,
    date_from: query.date_from || undefined,
    date_to: query.date_to || undefined,
  };
}
