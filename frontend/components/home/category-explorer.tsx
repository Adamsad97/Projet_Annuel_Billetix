"use client";

import Link from "next/link";
import type { ApiCategory } from "@/lib/api/categories";
import { DEFAULT_FILTERS, filtersToUrl } from "@/lib/catalogue/filters";
import { t } from "@/lib/i18n/translate";

/** Raccourcis vers le catalogue filtré, une tuile par catégorie active du référentiel admin. */
export function CategoryExplorer({ categories }: { categories: ApiCategory[] }) {
  const active = categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.display_order - b.display_order);
  if (active.length === 0) return null;

  return (
    <section className="border-t border-hairline-2 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-8 text-3xl font-bold text-ink-1">{t("Explorer par catégorie")}</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-8">
          {active.map((category) => (
            <li key={category.id}>
              <Link
                href={`/evenements${filtersToUrl({ ...DEFAULT_FILTERS, category: category.code })}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-hairline-3 bg-card px-5 py-5 transition-[border-color,box-shadow] hover:border-hairline-5 hover:shadow-lg hover:shadow-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="truncate text-lg font-semibold text-ink-1">{t(category.label)}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:rotate-45 motion-reduce:transition-none">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
