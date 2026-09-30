/** IBAN saisi (espaces, minuscules tolérés) → forme compacte en majuscules. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/**
 * Contrôle ISO 13616 : format, puis clé « modulo 97 » (les 4 premiers
 * caractères déplacés à la fin, lettres converties en nombres, reste = 1).
 * Détecte les fautes de frappe avant qu'un virement parte au mauvais endroit.
 */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Affichage masqué : « FR76 •••• •••• 1234 ». */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}
