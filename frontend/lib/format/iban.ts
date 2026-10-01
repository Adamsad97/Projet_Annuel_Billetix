import { activeLocale } from "@/lib/i18n/translate";

// Saisie d'un IBAN : majuscules, groupes de 4, longueur propre au pays.

export const IBAN_MAX_LENGTH = 34;

/** Longueur exacte de l'IBAN par pays (registre SWIFT + Afrique hors registre). */
export const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28,
  CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22,
  IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18,
  NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24, SC: 31,
  SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29,
  VA: 22, VG: 24, XK: 20, YE: 30,
  // Hors registre SWIFT (UEMOA, CEMAC, Maghreb, Iran, Honduras…)
  AO: 25, HN: 28, IR: 26, BF: 28, BJ: 28, CF: 27, CG: 27, CI: 28, CM: 27, CV: 25, DZ: 26, GA: 27, GQ: 27, GW: 25,
  KM: 27, MA: 28, MG: 27, ML: 28, MZ: 25, NE: 28, SN: 28, TD: 27, TG: 28,
};

/** Longueur attendue pour le pays saisi (2 premières lettres), si connue. */
export function ibanExpectedLength(value: string): number | null {
  const country = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  return IBAN_LENGTHS[country] ?? null;
}

/** Nombre de lettres et chiffres saisis (espaces exclus). */
export function ibanLength(value: string): number {
  return value.replace(/[^A-Za-z0-9]/g, "").length;
}

/** Pays proposés dans la liste, par nom dans la langue du site (« Allemagne » / « Germany »). */
export function ibanCountries(): Array<{ code: string; name: string; length: number }> {
  const locale = activeLocale();
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return Object.entries(IBAN_LENGTHS)
    .map(([code, length]) => ({ code, name: names.of(code) ?? code, length }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Nom d'un pays dans la langue du site. */
export function countryName(code: string): string {
  return new Intl.DisplayNames([activeLocale()], { type: "region" }).of(code) ?? code;
}

/** Gabarit de saisie montrant la longueur : « FRxx xxxx xxxx xxxx xxxx xxxx xxx ». */
export function ibanPlaceholder(country: string): string {
  const length = IBAN_LENGTHS[country] ?? IBAN_MAX_LENGTH;
  return `${country}${"x".repeat(length - 2)}`.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Remplace le code pays en tête de l'IBAN saisi (ou l'ajoute). */
export function withCountry(value: string, country: string): string {
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const rest = /^[A-Z]{2}/.test(compact) ? compact.slice(2) : compact;
  return formatIban(country + rest, country);
}

/** Groupes de 4 limités à la longueur du pays tapé en tête, sinon de celui choisi. */
export function formatIban(value: string, country?: string): string {
  const max = ibanExpectedLength(value) ?? (country ? IBAN_LENGTHS[country] : undefined) ?? IBAN_MAX_LENGTH;
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, max);
  return compact.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Curseur replacé après le même nombre de caractères utiles, pour corriger au milieu de l'IBAN. */
export function ibanCaret(raw: string, caret: number, formatted: string): number {
  const typedBefore = raw.slice(0, caret).replace(/[^A-Za-z0-9]/g, "").length;
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (seen === typedBefore) return index;
    if (formatted[index] !== " ") seen++;
  }
  return formatted.length;
}
