"use client";

import Link from "next/link";
import { t, msg } from "@/lib/i18n/translate";

const links = [
  { href: "/aide", label: msg("Aide") },
  { href: "/contact", label: msg("Contact") },
  { href: "/mentions-legales", label: msg("Mentions légales") },
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: msg("Confidentialité") },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline-1 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-ink-6">{t("© 2026 BilleTix SAS — Plateforme de billetterie sécurisée.")}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-ink-5 transition-colors hover:text-ink-3"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
