// Langue de la requête côté serveur : cookie choisi par le visiteur, sinon langue du navigateur.

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "@/lib/i18n/config";
import { translatorFor, type Translate } from "@/lib/i18n/translate";

export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export async function getT(): Promise<Translate> {
  return translatorFor(await getLocale());
}
