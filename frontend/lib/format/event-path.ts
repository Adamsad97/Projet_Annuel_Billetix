/**
 * Adresse de la page publique d'un événement : lisible
 * (/evenements/afro-vibes-festival-2026) dès qu'elle existe, sinon par
 * identifiant (redirigé vers l'adresse lisible par la page elle-même).
 */
export function eventPath(event: { id: string; slug?: string | null }): string {
  return `/evenements/${event.slug || event.id}`;
}
