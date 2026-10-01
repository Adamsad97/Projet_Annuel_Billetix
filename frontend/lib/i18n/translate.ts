// Traduction façon gettext : le texte français sert de clé, l'anglais est cherché dans le dictionnaire.

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/messages/en";

export type TranslateVars = Record<string, string | number | null | undefined>;
export type Translate = (text: string, vars?: TranslateVars) => string;

const dictionaries: Record<Locale, Record<string, string>> = { fr: {}, en };

/** Langue active côté navigateur, posée par I18nProvider ; le serveur passe la sienne explicitement. */
let browserLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale) {
  browserLocale = locale;
}

export function activeLocale(): Locale {
  return browserLocale;
}

function interpolate(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name] ?? "") : match));
}

/** Texte dans la langue demandée ; repli sur le français si la traduction manque. */
export function translate(locale: Locale, text: string, vars?: TranslateVars): string {
  return interpolate(dictionaries[locale][text] ?? text, vars);
}

/** Traduction hors composant React (fonctions utilitaires), dans la langue active du navigateur. */
export function t(text: string, vars?: TranslateVars): string {
  return translate(browserLocale, text, vars);
}

export function translatorFor(locale: Locale): Translate {
  return (text, vars) => translate(locale, text, vars);
}

/** Marque un texte statique (tableau de libellés…) traduit plus tard via t(variable). */
export function msg<T extends string>(text: T): T {
  return text;
}
