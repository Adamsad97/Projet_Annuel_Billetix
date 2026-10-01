import type { Locale } from "@/lib/i18n/config";
import { euros } from "@/lib/format/money";
import { activeLocale, translate } from "@/lib/i18n/translate";

/** Libellé du prix d'appel : « Entrée gratuite », « 25,00 € », ou rien (langue explicite côté serveur). */
export function fromPriceLabel(price: number | null | undefined, locale: Locale = activeLocale()): string | null {
  if (price === null || price === undefined) return null;
  return price === 0 ? translate(locale, "Entrée gratuite") : euros.format(price, locale);
}
