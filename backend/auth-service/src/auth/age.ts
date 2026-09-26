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
