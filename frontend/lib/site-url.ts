// Adresse publique du site (FRONTEND_URL), base des URL absolues de partage et canoniques ; côté serveur uniquement.

const FALLBACK_SITE_URL = "http://localhost:3000";

function parseSiteUrl(value: string | undefined): URL {
  try {
    return new URL(value || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const SITE_URL = parseSiteUrl(process.env.SITE_URL);

/** Champs de partage communs : une page qui définit son openGraph doit les reprendre. */
export const SHARED_OPEN_GRAPH = { siteName: "BilleTix", locale: "fr_FR", type: "website" } as const;
