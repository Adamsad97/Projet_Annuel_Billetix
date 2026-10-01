// Montants en euros dans la langue du site (« 1 234,50 € » ou « €1,234.50 »).

import type { Locale } from "@/lib/i18n/config";
import { localizedNumber } from "@/lib/i18n/intl";

/** Formateur euros, centimes compris. */
export const euros = localizedNumber({ style: "currency", currency: "EUR" });

/** Formateur euros arrondi à l'euro (axes de graphiques, grands totaux). */
export const roundEuros = localizedNumber({ style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Montant lisible ; accepte les décimaux renvoyés en texte par l'API. */
export function formatEuros(value: number | string | null | undefined, locale?: Locale): string {
  return euros.format(Number(value ?? 0), locale);
}
