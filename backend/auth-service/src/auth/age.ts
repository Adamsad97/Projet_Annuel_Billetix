/** Âge en années révolues pour une date « YYYY-MM-DD », calculé sur année/mois/jour (sans souci de fuseau). */
export function ageInYears(birthDate: string, today: Date = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  const birthdayNotYetReached =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (birthdayNotYetReached) age -= 1;
  return age;
}
