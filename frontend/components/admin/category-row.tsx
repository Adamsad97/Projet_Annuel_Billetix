"use client";

import { useState } from "react";
import type { ApiCategory } from "@/lib/api/categories";

export function CategoryRow({
  category,
  onSave,
  onToggleActive,
  onDelete,
}: {
  category: ApiCategory;
  onSave: (id: string, dto: { label: string; emoji: string; display_order: number }) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(category.label);
  const [emoji, setEmoji] = useState(category.emoji ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(category.display_order));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(category.id, { label, emoji, display_order: Number(displayOrder) || 0 });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="grid grid-cols-[60px_1fr_90px_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
        <input
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          maxLength={8}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-center text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <input
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(event.target.value)}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/20"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[60px_1fr_90px_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
      <span className="text-center text-xl">{category.emoji || "🏷️"}</span>
      <div>
        <p className={category.is_active ? "text-sm font-medium text-white" : "text-sm font-medium text-gray-500 line-through"}>
          {category.label}
        </p>
        <p className="text-xs text-gray-500">{category.code}</p>
      </div>
      <span className="text-center text-sm text-gray-400">{category.display_order}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleActive(category.id, !category.is_active)}
          className={
            category.is_active
              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
              : "rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs font-medium text-gray-400 transition-colors hover:border-white/20"
          }
        >
          {category.is_active ? "Active" : "Désactivée"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:border-white/20"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onDelete(category.id)}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:border-red-500/30 hover:bg-red-500/5"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
