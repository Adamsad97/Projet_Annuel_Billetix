"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/provider";
import { LocaleFlag } from "@/components/layout/locale-flag";

/** Liste déroulante de la langue du site ; le choix est mémorisé un an (cookie) et la page se met à jour. */
export function LanguageSelect() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    saveLocaleChoice(next);
    startTransition(() => router.refresh());
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("Langue du site")}
        title={t("Langue du site")}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 items-center gap-1.5 rounded-full border border-hairline-2 px-2.5 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-4 hover:text-ink-1 ${pending ? "opacity-60" : ""}`}
      >
        <LocaleFlag locale={locale} />
        <span className="hidden sm:inline">{LOCALE_NAMES[locale].short}</span>
        <svg className="hidden sm:block" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("Langue du site")}
          className="absolute right-0 top-11 z-50 min-w-40 overflow-hidden rounded-xl border border-hairline-2 bg-card py-1 shadow-xl shadow-black/20"
        >
          {LOCALES.map((option) => (
            <li key={option} role="option" aria-selected={option === locale}>
              <button
                type="button"
                lang={option}
                onClick={() => choose(option)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-hairline-1 ${option === locale ? "font-semibold text-ink-1" : "text-ink-3"}`}
              >
                <LocaleFlag locale={option} />
                <span className="flex-1">{LOCALE_NAMES[option].name}</span>
                {option === locale ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-link" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Mémorise la langue choisie un an, lue par le serveur à chaque requête. */
function saveLocaleChoice(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
