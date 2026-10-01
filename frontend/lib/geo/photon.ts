// Autocomplétion d'adresse au fil de la frappe via Photon (OpenStreetMap), gratuit et sans clé.
import { ApiError } from "@/lib/api/http-error";
import { t } from "@/lib/i18n/translate";

export interface AddressSuggestion {
  label: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  /** Code ISO 3166-1 alpha-2 en majuscules ("GN"), vide si inconnu. */
  countryCode: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
}

function buildAddressLine(props: PhotonFeature["properties"]): string {
  const streetPart = [props.housenumber, props.street].filter(Boolean).join(" ").trim();
  return streetPart || props.name || "";
}

function buildLabel(props: PhotonFeature["properties"]): string {
  const addressLine = buildAddressLine(props);
  const cityPart = [props.postcode, props.city ?? props.district].filter(Boolean).join(" ");
  const showName = props.name && props.name !== addressLine;
  return [showName ? props.name : null, addressLine, cityPart].filter(Boolean).join(", ");
}

// Recherche mondiale ; les résultats du pays saisi passent en tête (une bbox Photon filtrerait strictement).
function normalizeCountry(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Plus large que le nombre affiché : laisse de la marge pour remonter les
// résultats du pays saisi avant de tronquer.
const FETCH_LIMIT = 15;
const DISPLAY_LIMIT = 6;

export async function searchAddress(
  query: string,
  preferredCountry?: string,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const search = new URLSearchParams({ q: trimmed, limit: String(FETCH_LIMIT), lang: "fr" });

  let response: Response;
  try {
    response = await fetch(`https://photon.komoot.io/api/?${search.toString()}`);
  } catch {
    throw new ApiError(0, t("Impossible de contacter le service d'adresses."));
  }

  if (!response.ok) {
    throw new ApiError(response.status, t("Service d'adresses indisponible, réessayez plus tard."));
  }

  const data = (await response.json()) as { features: PhotonFeature[] };
  const preferred = preferredCountry ? normalizeCountry(preferredCountry) : "";
  const inPreferred = (f: PhotonFeature) =>
    preferred !== "" && normalizeCountry(f.properties.country ?? "") === preferred;

  return data.features
    .filter((f) => f.properties.street || f.properties.housenumber || f.properties.name)
    // Tri stable : l'ordre de pertinence de Photon est conservé dans chaque groupe.
    .sort((a, b) => Number(inPreferred(b)) - Number(inPreferred(a)))
    .slice(0, DISPLAY_LIMIT)
    .map((f) => ({
      label: buildLabel(f.properties),
      addressLine1: buildAddressLine(f.properties) || trimmed,
      city: f.properties.city ?? f.properties.district ?? "",
      postalCode: f.properties.postcode ?? "",
      country: f.properties.country ?? "",
      countryCode: (f.properties.countrycode ?? "").toUpperCase(),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}
