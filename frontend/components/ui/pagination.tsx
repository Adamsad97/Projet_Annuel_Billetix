"use client";

import { t } from "@/lib/i18n/translate";
// Navigation « ← Précédent · Page 2 / 5 · Suivant → ». Pages numérotées à partir de 1.

const BUTTON = "rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40";

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={t("Pagination")} className="flex items-center justify-center gap-3 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={BUTTON}>{t("← Précédent")}</button>
      <span className="text-ink-5">{t("Page {page} / {pageCount}", { page, pageCount })}</span>
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className={BUTTON}>{t("Suivant →")}</button>
    </nav>
  );
}
