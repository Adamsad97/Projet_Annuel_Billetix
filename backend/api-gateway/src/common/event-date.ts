/** Date d'événement lisible dans un email (« samedi 24 octobre 2026 »). */
export function formatEventDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
