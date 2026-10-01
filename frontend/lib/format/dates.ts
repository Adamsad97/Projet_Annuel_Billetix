// Formats de date du site (fuseau du navigateur) ; pour un événement, préférer son fuseau (formatInZone).

/** « 30 septembre 2026 » */
export const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** « 30 sept. 2026 » */
export const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** « 30 sept. » */
export const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « 30 sept. 2026, 14:39 » */
export const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** « 30 septembre 2026 à 14:39 » */
export const longDateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** « mercredi 30 septembre 2026 à 14:39 » */
export const fullDateTime = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 14:39 » */
export const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
