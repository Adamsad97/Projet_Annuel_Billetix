// Miroir de backend/auth-service/src/auth/age.ts — auth-service refait le
// contrôle d'âge à l'inscription et fait foi.

/**
 * Âge en années révolues à la date du jour, pour une date "YYYY-MM-DD".
 * Calcul sur les composantes année/mois/jour (pas de différence de
 * timestamps) : insensible aux fuseaux et aux années bissextiles.
 */
export function ageInYears(birthDate: string, today: Date = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  const birthdayNotYetReached =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (birthdayNotYetReached) age -= 1;
  return age;
}

/** Message affiché dès qu'une date de naissance sous l'âge minimum est saisie. */
export function underageMessage(minimumAge: number): string {
  // L'âge minimum est réglable par l'admin : « majeures » seulement s'il
  // correspond bien à la majorité (ou plus).
  const audience = minimumAge >= 18 ? "aux personnes majeures" : `aux personnes d'au moins ${minimumAge} ans`;
  return `Vous devez avoir au moins ${minimumAge} ans pour utiliser BilletiX. L'inscription est réservée ${audience}.`;
}
