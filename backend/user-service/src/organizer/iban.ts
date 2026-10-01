/** Longueur exacte de l'IBAN par pays (registre SWIFT et pays d'Afrique qui l'utilisent hors registre). */
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

/** IBAN saisi (espaces, minuscules tolérés) → forme compacte en majuscules. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** Motif de refus d'un IBAN, ou null : format, longueur du pays, puis clé modulo 97 (ISO 13616). */
export function ibanError(iban: string): string | null {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return 'IBAN invalide : il commence par 2 lettres (le pays) puis 2 chiffres.';
  }
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) {
    return `IBAN invalide : un IBAN ${iban.slice(0, 2)} comporte ${expected} caractères (${iban.length} saisis).`;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1 ? null : 'IBAN invalide : vérifiez les caractères saisis.';
}

export function isValidIban(iban: string): boolean {
  return ibanError(iban) === null;
}

/** Affichage masqué : « FR76 •••• •••• 1234 ». */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}
