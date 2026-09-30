// Montants en euros — un seul format pour tout le site (« 1 234,50 € »).

/** Formateur euros, centimes compris. */
export const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Formateur euros arrondi à l'euro (axes de graphiques, grands totaux). */
export const roundEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Montant lisible ; accepte les décimaux renvoyés en texte par l'API. */
export function formatEuros(value: number | string | null | undefined): string {
  return euros.format(Number(value ?? 0));
}
