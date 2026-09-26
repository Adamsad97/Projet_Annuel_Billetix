// Géocodage adresse → coordonnées via Nominatim (OpenStreetMap) — gratuit,
// sans clé API. Usage volontairement ponctuel (bouton "Localiser sur la
// carte", jamais déclenché à chaque frappe) : la politique d'usage de
// l'instance publique limite à 1 req/s et attend un usage raisonnable,
// jamais adapté à de l'auto-complétion en direct.
import { ApiError } from "@/lib/api/http-error";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const search = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "1",
  });

  let response: Response;
  try {
    response = await fetch(`https://nominatim.openstreetmap.org/search?${search.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(0, "Impossible de contacter le service de géolocalisation.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, "Le service de géolocalisation est indisponible, réessayez plus tard.");
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (results.length === 0) return null;

  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    displayName: results[0].display_name,
  };
}
