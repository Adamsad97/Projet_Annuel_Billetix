/** Adresse publique d'un événement : lisible si elle existe, sinon par identifiant. */
export function eventPath(event: { id: string; slug?: string | null }): string {
  return `/evenements/${event.slug || event.id}`;
}
