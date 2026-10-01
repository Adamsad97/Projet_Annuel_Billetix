// Formats de date du site dans sa langue (fuseau du navigateur) ; pour un événement, préférer son fuseau (formatInZone).

import { localizedDate } from "@/lib/i18n/intl";

/** « 30 septembre 2026 » */
export const longDate = localizedDate({ day: "numeric", month: "long", year: "numeric" });

/** « 30 sept. 2026 » */
export const shortDate = localizedDate({ day: "numeric", month: "short", year: "numeric" });

/** « 30 sept. » */
export const dayMonth = localizedDate({ day: "numeric", month: "short" });

/** « 30 sept. 2026, 14:39 » */
export const dateTime = localizedDate({ dateStyle: "medium", timeStyle: "short" });

/** « 30 septembre 2026 à 14:39 » */
export const longDateTime = localizedDate({ dateStyle: "long", timeStyle: "short" });

/** « mercredi 30 septembre 2026 à 14:39 » */
export const fullDateTime = localizedDate({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 14:39 » */
export const time = localizedDate({ hour: "2-digit", minute: "2-digit" });
