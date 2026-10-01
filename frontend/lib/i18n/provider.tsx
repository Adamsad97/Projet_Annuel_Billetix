"use client";

import { createContext, Fragment, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { setActiveLocale, translatorFor, type Translate } from "@/lib/i18n/translate";

const LocaleContext = createContext<Locale>("fr");

/** Langue lue par le serveur (cookie), partagée avec tous les composants client. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Posée pendant le rendu, avant les enfants : les fonctions utilitaires formatent dans la bonne langue.
  setActiveLocale(locale);
  // Remontage complet au changement de langue : chaque texte se retraduit.
  return (
    <LocaleContext.Provider value={locale}>
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Fonction de traduction (texte français → langue active), variables entre accolades. */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translatorFor(locale), [locale]);
}
