// Bug corrigé : les dates des emails étaient formatées sans fuseau, donc
// dans celui du serveur (UTC en conteneur) — un billet scanné à 07:05 à
// Paris affichait « 05:05 », et une date proche de minuit pouvait changer
// de jour. Toujours formater dans le fuseau de l'événement.

/** Fuseau par défaut d'un événement (même valeur que la colonne events.timezone). */
export const DEFAULT_EVENT_TIMEZONE = "Europe/Paris";

function inZone(timeZone: string | null | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return { ...options, timeZone: timeZone || DEFAULT_EVENT_TIMEZONE };
}

/** Date d'événement lisible dans un email (« samedi 24 octobre 2026 »). */
export function formatEventDate(value: string | Date, timeZone?: string | null): string {
  return new Date(value).toLocaleDateString(
    "fr-FR",
    inZone(timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  );
}

/** Date et heure d'un fait (« le 30 septembre 2026 à 07:05 »). */
export function formatEventDateTime(value: string | Date, timeZone?: string | null): string {
  const date = new Date(value);
  const day = date.toLocaleDateString("fr-FR", inZone(timeZone, { day: "numeric", month: "long", year: "numeric" }));
  const time = date.toLocaleTimeString("fr-FR", inZone(timeZone, { hour: "2-digit", minute: "2-digit" }));
  return `le ${day} à ${time}`;
}
