// Formateurs Intl dans la langue active, avec la même interface que Intl (.format) ; instances mises en cache.

import { intlLocale, type Locale } from "@/lib/i18n/config";
import { activeLocale } from "@/lib/i18n/translate";

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

export function numberFormat(options: Intl.NumberFormatOptions = {}, locale: Locale = activeLocale()): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(locale), options);
    numberCache.set(key, formatter);
  }
  return formatter;
}

export function dateFormat(options: Intl.DateTimeFormatOptions = {}, locale: Locale = activeLocale()): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale(locale), options);
    dateCache.set(key, formatter);
  }
  return formatter;
}

export interface LocalizedNumberFormat {
  format(value: number | bigint, locale?: Locale): string;
}

export interface LocalizedDateFormat {
  format(date?: Date | number, locale?: Locale): string;
}

/** Formateur de nombres qui suit la langue active (ou celle passée explicitement côté serveur). */
export function localizedNumber(options: Intl.NumberFormatOptions): LocalizedNumberFormat {
  return { format: (value, locale) => numberFormat(options, locale).format(value) };
}

/** Formateur de dates qui suit la langue active (ou celle passée explicitement côté serveur). */
export function localizedDate(options: Intl.DateTimeFormatOptions): LocalizedDateFormat {
  return { format: (date, locale) => dateFormat(options, locale).format(date) };
}
