// Page où revenir après connexion (?next=). Seuls les chemins internes sont
// suivis — jamais "//domaine" (redirection ouverte) ni /connexion (boucle).

const OAUTH_NEXT_KEY = "billetix_oauth_next";

export function postLoginPath(next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/connexion")) {
    return next;
  }
  return "/";
}

/** Connexion Google/Facebook : ?next= mémorisé le temps de l'aller-retour (onglet courant). */
export function rememberOAuthNext(next?: string | null): void {
  try {
    if (next) window.sessionStorage.setItem(OAUTH_NEXT_KEY, next);
    else window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
  } catch {
    // Stockage indisponible : retour à l'accueil après connexion.
  }
}

/** Page à ouvrir au retour de Google/Facebook (lue une seule fois). */
export function consumeOAuthNext(): string {
  try {
    const next = window.sessionStorage.getItem(OAUTH_NEXT_KEY);
    window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
    return postLoginPath(next);
  } catch {
    return "/";
  }
}

/** Reconnexion exigée avant une action sensible, puis retour sur `path`. */
export function reauthUrl(path: string): string {
  return `/connexion?reauth=sensible&next=${encodeURIComponent(path)}`;
}
