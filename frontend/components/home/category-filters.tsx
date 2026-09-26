"use client";

// Raccourcis vers le catalogue filtré : catégories actives du référentiel
// géré par l'admin (GET /events/categories).

import Link from "next/link";
import { useEffect, useState } from "react";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";

const pillClassName =
  "rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 hover:text-ink-1";

export function CategoryFilters() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  useEffect(() => {
    listCategories()
      .then((list) => setCategories([...list].sort((a, b) => a.display_order - b.display_order)))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Link href="/catalogue" className={pillClassName}>
        Tous
      </Link>
      {categories.map((category) => (
        <Link key={category.id} href={`/catalogue?categorie=${encodeURIComponent(category.code)}`} className={pillClassName}>
          {category.emoji ? <span className="mr-1.5">{category.emoji}</span> : null}
          {category.label}
        </Link>
      ))}
      <Link href="/catalogue" className={pillClassName}>
        <LocationPinIcon className="-mt-0.5 mr-1.5 inline" />
        Près de moi
      </Link>
    </div>
  );
}
