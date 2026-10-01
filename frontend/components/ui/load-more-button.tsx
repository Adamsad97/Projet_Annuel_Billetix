"use client";

import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n/translate";

// Bouton « Afficher plus » sous une liste chargée par pages.

export function LoadMoreButton({
  onClick,
  loading = false,
  remaining,
  label = t("Afficher plus"),
}: {
  onClick: () => void;
  loading?: boolean;
  /** Nombre d'éléments pas encore affichés, si connu. */
  remaining?: number;
  label?: string;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={buttonClass("secondary", "rounded-full px-6 py-2.5 text-sm disabled:opacity-50")}
      >
        {loading
          ? t("Chargement…")
          : remaining !== undefined
            ? `${label} (${remaining} restant${remaining > 1 ? "s" : ""})`
            : label}
      </button>
    </div>
  );
}
