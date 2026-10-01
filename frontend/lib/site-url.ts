// Adresse publique du site (FRONTEND_URL du déploiement, la même que celle
// des liens d'emails). Sert de base aux URL absolues des aperçus de partage
// (Open Graph) et des adresses canoniques. Lue côté serveur uniquement.

const FALLBACK_SITE_URL = "http://localhost:3000";

function parseSiteUrl(value: string | undefined): URL {
  try {
    return new URL(value || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export const SITE_URL = parseSiteUrl(process.env.SITE_URL);

/**
 * Champs de partage communs à toutes les pages. Une page qui définit son
 * propre openGraph remplace entièrement celui du layout : elle doit les
 * reprendre.
 */
export const SHARED_OPEN_GRAPH = { siteName: "BilleTix", locale: "fr_FR", type: "website" } as const;
