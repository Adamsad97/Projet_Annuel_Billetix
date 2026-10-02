"use client";

import Link from "next/link";
import type { ApiCategory } from "@/lib/api/categories";
import { DEFAULT_FILTERS, filtersToUrl } from "@/lib/catalogue/filters";
import { CategoryIcon } from "@/components/home/category-icon";
import { t } from "@/lib/i18n/translate";

// Teintes attribuées tour à tour aux tuiles (réglage d'interface : les
// catégories sont libres côté admin). Classes écrites en entier pour Tailwind.
const TINTS = [
  { glow: "bg-orange-500/25", chip: "bg-orange-500/15 ring-orange-500/30 text-orange-500", hover: "hover:border-orange-500/50 hover:shadow-orange-500/20" },
  { glow: "bg-rose-500/25", chip: "bg-rose-500/15 ring-rose-500/30 text-rose-500", hover: "hover:border-rose-500/50 hover:shadow-rose-500/20" },
  { glow: "bg-violet-500/25", chip: "bg-violet-500/15 ring-violet-500/30 text-violet-500", hover: "hover:border-violet-500/50 hover:shadow-violet-500/20" },
  { glow: "bg-sky-500/25", chip: "bg-sky-500/15 ring-sky-500/30 text-sky-500", hover: "hover:border-sky-500/50 hover:shadow-sky-500/20" },
  { glow: "bg-emerald-500/25", chip: "bg-emerald-500/15 ring-emerald-500/30 text-emerald-500", hover: "hover:border-emerald-500/50 hover:shadow-emerald-500/20" },
  { glow: "bg-amber-500/25", chip: "bg-amber-500/15 ring-amber-500/30 text-amber-500", hover: "hover:border-amber-500/50 hover:shadow-amber-500/20" },
  { glow: "bg-fuchsia-500/25", chip: "bg-fuchsia-500/15 ring-fuchsia-500/30 text-fuchsia-500", hover: "hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/20" },
  { glow: "bg-teal-500/25", chip: "bg-teal-500/15 ring-teal-500/30 text-teal-500", hover: "hover:border-teal-500/50 hover:shadow-teal-500/20" },
  { glow: "bg-indigo-500/25", chip: "bg-indigo-500/15 ring-indigo-500/30 text-indigo-500", hover: "hover:border-indigo-500/50 hover:shadow-indigo-500/20" },
  { glow: "bg-lime-500/25", chip: "bg-lime-500/15 ring-lime-500/30 text-lime-500", hover: "hover:border-lime-500/50 hover:shadow-lime-500/20" },
] as const;

function countLabel(count: number | undefined): string {
  if (!count) return t("Découvrir");
  return count === 1 ? t("1 événement") : t("{count} événements", { count });
}

/** Raccourcis vers le catalogue filtré, une tuile par catégorie active du référentiel admin. */
export function CategoryExplorer({
  categories,
  counts = {},
}: {
  categories: ApiCategory[];
  /** Événements publiés par code de catégorie. */
  counts?: Record<string, number>;
}) {
  const active = categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.display_order - b.display_order);
  if (active.length === 0) return null;

  return (
    <section aria-labelledby="category-explorer-title">
      <div className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 max-w-2xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand ring-1 ring-inset ring-brand/25">{t("Catégories")}</span>
          <h2 id="category-explorer-title" className="text-3xl font-extrabold tracking-tight text-ink-1 sm:text-4xl">{t("Explorer par catégorie")}</h2>
          <p className="mt-3 text-base text-ink-4">{t("Trouvez l'événement qui vous ressemble, en un clic.")}</p>
        </div>

        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {active.map((category, index) => {
            const tint = TINTS[index % TINTS.length];
            return (
              <li key={category.id}>
                <Link
                  href={`/evenements${filtersToUrl({ ...DEFAULT_FILTERS, category: category.code })}`}
                  className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-xl border border-hairline-3 bg-card px-4 py-3.5 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tint.hover}`}
                >
                  {/* Lueur colorée qui s'étend au survol. */}
                  <span aria-hidden="true" className={`pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full opacity-60 blur-2xl transition-[transform,opacity] duration-500 group-hover:scale-[2.5] group-hover:opacity-100 motion-reduce:transition-none ${tint.glow}`} />

                  <span aria-hidden="true" className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none ${tint.chip}`}>
                    <CategoryIcon code={category.code} emoji={category.emoji} className="h-5 w-5" />
                  </span>

                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-ink-1">{t(category.label)}</span>
                    <span className="block truncate text-xs text-ink-5">{countLabel(counts[category.code])}</span>
                  </span>

                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-md shadow-brand/30 transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
