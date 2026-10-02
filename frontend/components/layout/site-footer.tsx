"use client";

import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { t, msg } from "@/lib/i18n/translate";

// Uniquement des pages qui existent sur le site.
const columns = [
  {
    title: msg("Découvrir"),
    links: [
      { href: "/evenements", label: msg("Événements") },
      { href: "/revente", label: msg("Revente de billets") },
      { href: "/devenir-organisateur", label: msg("Devenir organisateur") },
    ],
  },
  {
    title: msg("Aide & contact"),
    links: [
      { href: "/aide", label: msg("FAQ") },
      { href: "/contact", label: msg("Nous contacter") },
    ],
  },
  {
    title: msg("Informations légales"),
    links: [
      { href: "/cgu", label: msg("Conditions d'utilisation") },
      { href: "/mentions-legales", label: msg("Mentions légales") },
      { href: "/confidentialite", label: msg("Politique de confidentialité") },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-hairline-2 bg-card">
      {/* Liseré et halo de marque en haut du pied de page. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col items-start gap-4">
            <Link href="/" aria-label={t("Accueil")} className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              <Logo />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-ink-4">{t("La billetterie simple et sécurisée pour découvrir, acheter et revendre vos billets en toute confiance.")}</p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={t(column.title)}>
              <h2 className="mb-4 text-base font-bold text-ink-1">{t(column.title)}</h2>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-ink-4 transition-colors hover:text-ink-1"
                    >
                      <span aria-hidden="true" className="h-px w-0 bg-brand transition-[width] duration-300 group-hover:w-3 motion-reduce:transition-none" />
                      {t(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-hairline-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-5">{t("© {year} BilleTix. Tous droits réservés.", { year })}</p>
          <p className="inline-flex items-center gap-2 text-xs font-medium text-ink-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-success">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {t("Paiement sécurisé")}
          </p>
        </div>
      </div>
    </footer>
  );
}
