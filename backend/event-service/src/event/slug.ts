/** Longueur maximale d'une adresse lisible, suffixe anti-doublon compris. */
export const SLUG_MAX_LENGTH = 100;
const BASE_MAX_LENGTH = 90; // place laissée au suffixe « -123 »

/** Adresse lisible tirée du titre : sans accents, en minuscules, le reste remplacé par des tirets. */
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

/** Première adresse libre parmi base, base-2, base-3… */
export function firstFreeSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
