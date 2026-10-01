"use client";

import type { ApiCategory } from "@/lib/api/categories";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

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
      <p className="text-sm text-ink-5">{t("Aucune catégorie disponible pour le moment — contactez l'équipe BilleTix.")}</p>
    );
  }

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={fieldClass("px-4 py-3")}
    >
      {categories.map((category) => (
        <option key={category.code} value={category.code} className="bg-card">
          {category.emoji ? `${category.emoji} ` : ""}
          {category.label}
        </option>
      ))}
    </select>
  );
}
