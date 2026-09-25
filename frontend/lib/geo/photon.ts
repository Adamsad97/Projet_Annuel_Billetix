// Autocomplétion d'adresse au fil de la frappe — Photon (service public de
// Komoot, basé sur les données OpenStreetMap), gratuit et sans clé API.
// Distinct de Nominatim (lib/geo/nominatim.ts, gardé pour le géocodage
// ponctuel côté carte) : la politique d'usage de Nominatim déconseille
// explicitement l'autocomplétion (recherche à chaque frappe) sur son
// instance publique limitée à 1 req/s — Photon est conçu pour cet usage.
import { ApiError } from "@/lib/api/http-error";
import { FRANCE_BBOX, FRANCE_CENTER } from "./france";

export interface AddressSuggestion {
  label: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

export interface GeoBias {
  bbox: string; // "minLon,minLat,maxLon,maxLat"
  center: [number, number]; // [lat, lon]
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
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
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

// Bug corrigé : le biais était figé sur la France — inutilisable si un
// organisateur crée un événement dans un autre pays (plateforme censée
// rester accessible à l'international). Résout dynamiquement le pays
// réellement saisi dans le formulaire ("Pays", texte libre) en zone
// géographique de biais, via Photon lui-même (recherche du pays comme
// entité administrative, filtrée par osm_tag=place:country).
//
// Mis en cache par nom de pays : ce champ change rarement pendant qu'on
// tape une adresse, inutile de le re-résoudre à chaque frappe.
const countryBiasCache = new Map<string, GeoBias | null>();

export async function resolveCountryBias(country: string): Promise<GeoBias | null> {
  const key = country.trim().toLowerCase();
  if (!key || key === "france") {
    // Cas par défaut du formulaire — pas d'appel réseau nécessaire, et
    // évite le cas dégénéré où le contour OSM "France" (admin_level 2)
    // engloberait aussi les territoires d'outre-mer, ce qui donnerait une
    // bbox bien trop large pour un biais utile.
    return { bbox: FRANCE_BBOX, center: FRANCE_CENTER };
  }

  if (countryBiasCache.has(key)) return countryBiasCache.get(key) ?? null;

  try {
    const search = new URLSearchParams({
      q: country.trim(),
      limit: "1",
      osm_tag: "place:country",
    });
    const response = await fetch(`https://photon.komoot.io/api/?${search.toString()}`);
    if (!response.ok) throw new Error();

    const data = (await response.json()) as { features: PhotonFeature[] };
    const extent = data.features[0]?.properties.extent;
    const coords = data.features[0]?.geometry.coordinates;
    if (!extent || !coords) {
      countryBiasCache.set(key, null);
      return null;
    }

    const [minLon, maxLat, maxLon, minLat] = extent;
    const bias: GeoBias = {
      bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
      center: [coords[1], coords[0]],
    };
    countryBiasCache.set(key, bias);
    return bias;
  } catch {
    // Pays non reconnu (faute de frappe, saisie en cours…) — mieux vaut une
    // recherche non biaisée qu'un mauvais biais.
    countryBiasCache.set(key, null);
    return null;
  }
}

export async function searchAddress(
  query: string,
  bias?: GeoBias | null,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const search = new URLSearchParams({ q: trimmed, limit: "5", lang: "fr" });
  if (bias) {
    search.set("bbox", bias.bbox);
    search.set("lat", String(bias.center[0]));
    search.set("lon", String(bias.center[1]));
    search.set("zoom", "6");
  }

  let response: Response;
  try {
    response = await fetch(`https://photon.komoot.io/api/?${search.toString()}`);
  } catch {
    throw new ApiError(0, "Impossible de contacter le service d'adresses.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, "Service d'adresses indisponible, réessaie plus tard.");
  }

  const data = (await response.json()) as { features: PhotonFeature[] };
  return data.features
    .filter((f) => f.properties.street || f.properties.housenumber || f.properties.name)
    .map((f) => ({
      label: buildLabel(f.properties),
      addressLine1: buildAddressLine(f.properties) || trimmed,
      city: f.properties.city ?? f.properties.district ?? "",
      postalCode: f.properties.postcode ?? "",
      country: f.properties.country ?? "",
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
}
