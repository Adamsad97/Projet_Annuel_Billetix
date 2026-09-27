// Recherche plein texte côté client : insensible à la casse et aux accents
// (« Éloïse » est trouvée en tapant « eloise »).

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Vrai si la recherche est vide ou contenue dans l'un des champs. */
export function matchesSearch(query: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return fields.some((field) => field && normalizeSearch(field).includes(needle));
}
