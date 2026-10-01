"use client";

import { useState } from "react";
import type { ApiCategory } from "@/lib/api/categories";
import { t } from "@/lib/i18n/translate";

export function CategoryRow({
  category,
  onSave,
  onToggleActive,
  onDelete,
}: {
  category: ApiCategory;
  /** Rejette en cas d'échec (message affiché par la page) : la ligne reste en édition. */
  onSave: (id: string, dto: { code: string; label: string; emoji: string; display_order: number }) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(category.code);
  const [label, setLabel] = useState(category.label);
  const [emoji, setEmoji] = useState(category.emoji ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(category.display_order));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(category.id, { code, label, emoji, display_order: Number(displayOrder) || 0 });
      setEditing(false);
    } catch {
      // Erreur affichée par la page ; la saisie reste modifiable.
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="grid grid-cols-[60px_1fr_90px_auto] items-center gap-3 border-b border-hairline-1 px-4 py-3 last:border-b-0">
        <input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          maxLength={8}
          className="rounded-lg border border-hairline-2 bg-hairline-1 px-2 py-1.5 text-center text-sm text-ink-1 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-col gap-1.5">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            aria-label={t("Nom")}
            className="rounded-lg border border-hairline-2 bg-hairline-1 px-3 py-1.5 text-sm text-ink-1 focus:border-blue-500 focus:outline-none"
          />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            maxLength={30}
            aria-label={t("Code")}
            title={t("Code (majuscules, chiffres, underscore) — les événements de cette catégorie suivent automatiquement")}
            className="rounded-lg border border-hairline-2 bg-hairline-1 px-3 py-1 font-mono text-xs text-ink-3 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <input
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(event.target.value)}
          className="rounded-lg border border-hairline-2 bg-hairline-1 px-2 py-1.5 text-sm text-ink-1 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >{t("Enregistrer")}</button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-hairline-2 px-3 py-1.5 text-xs font-medium text-ink-3 hover:border-hairline-4"
          >{t("Annuler")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[60px_1fr_90px_auto] items-center gap-3 border-b border-hairline-1 px-4 py-3 last:border-b-0">
      <span className="text-center text-xl">{category.emoji || "🏷️"}</span>
      <div>
        <p className={category.is_active ? "text-sm font-medium text-ink-1" : "text-sm font-medium text-ink-5 line-through"}>
          {category.label}
        </p>
        <p className="text-xs text-ink-5">{category.code}</p>
      </div>
      <span className="text-center text-sm text-ink-4">{category.display_order}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleActive(category.id, !category.is_active)}
          className={
            category.is_active
              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
              : "rounded-full border border-hairline-2 bg-hairline-1 px-3 py-1 text-xs font-medium text-ink-4 transition-colors hover:border-hairline-4"
          }
        >
          {category.is_active ? t("Désactiver") : t("Activer")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-hairline-2 px-2.5 py-1 text-xs font-medium text-ink-3 transition-colors hover:border-hairline-4"
        >{t("Modifier")}</button>
        <button
          type="button"
          onClick={() => onDelete(category.id)}
          className="rounded-lg border border-hairline-2 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-500/30 hover:bg-red-500/5"
        >{t("Supprimer")}</button>
      </div>
    </div>
  );
}
