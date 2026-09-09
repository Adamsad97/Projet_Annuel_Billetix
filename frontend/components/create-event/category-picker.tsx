"use client";

import type { ApiCategory } from "@/lib/api/categories";

// Liste réelle gérée depuis l'espace Admin (GET /events/categories) — plus
// de liste figée côté frontend, cf. lib/api/categories.ts.
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: ApiCategory[];
  value: string;
  onChange: (code: string) => void;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucune catégorie disponible pour le moment — contacte l&apos;équipe BilletiX.
      </p>
    );
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-violet-500 focus:outline-none"
    >
      {categories.map((category) => (
        <option key={category.code} value={category.code} className="bg-[#12101c]">
          {category.emoji ? `${category.emoji} ` : ""}
          {category.label}
        </option>
      ))}
    </select>
  );
}
