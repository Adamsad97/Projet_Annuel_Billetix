// Saisie d'un IBAN : lettres et chiffres seulement, en majuscules, groupés
// par 4 (« FR76 3000 6000 0112 3456 7890 189 »). 34 caractères au plus.

export const IBAN_MAX_LENGTH = 34;

export function formatIban(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, IBAN_MAX_LENGTH);
  return compact.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Position du curseur après reformatage : juste après le même nombre de
 * lettres et chiffres qu'avant, pour pouvoir corriger au milieu de l'IBAN.
 */
export function ibanCaret(raw: string, caret: number, formatted: string): number {
  const typedBefore = raw.slice(0, caret).replace(/[^A-Za-z0-9]/g, "").length;
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (seen === typedBefore) return index;
    if (formatted[index] !== " ") seen++;
  }
  return formatted.length;
}
