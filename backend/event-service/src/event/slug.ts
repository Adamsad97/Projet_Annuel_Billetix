/** Longueur maximale d'une adresse lisible, suffixe anti-doublon compris. */
export const SLUG_MAX_LENGTH = 100;
const BASE_MAX_LENGTH = 90; // place laissée au suffixe « -123 »

/**
 * Adresse lisible d'un événement tirée de son titre :
 * « Afro Vibes Festival 2026 ! » → « afro-vibes-festival-2026 ».
 * Accents retirés, minuscules, tout le reste remplacé par des tirets.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BASE_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug || 'evenement';
}

/**
 * Première adresse libre : `base`, sinon `base-2`, `base-3`…
 * `taken` : adresses déjà utilisées commençant par `base`.
 */
export function firstFreeSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
