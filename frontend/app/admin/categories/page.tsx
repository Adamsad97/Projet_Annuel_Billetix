"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { CategoryRow } from "@/components/admin/category-row";
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  updateCategory,
  type ApiCategory,
} from "@/lib/api/categories";
import { ApiError } from "@/lib/api/http-error";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ApiCategory[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    listAllCategories()
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les catégories."));
  }

  useEffect(load, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await createCategory({
        code: newCode.trim().toUpperCase(),
        label: newLabel.trim(),
        emoji: newEmoji.trim() || undefined,
        display_order: (categories?.length ?? 0) + 1,
      });
      setCategories((prev) => [...(prev ?? []), created]);
      setNewCode("");
      setNewLabel("");
      setNewEmoji("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer la catégorie.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(id: string, dto: { label: string; emoji: string; display_order: number }) {
    setError(null);
    try {
      const updated = await updateCategory(id, { label: dto.label, emoji: dto.emoji || undefined, display_order: dto.display_order });
      setCategories((prev) => prev?.map((category) => (category.id === id ? updated : category)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de modifier la catégorie.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setError(null);
    try {
      const updated = await updateCategory(id, { is_active: isActive });
      setCategories((prev) => prev?.map((category) => (category.id === id ? updated : category)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de modifier la catégorie.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer définitivement cette catégorie ?")) return;
    setError(null);
    try {
      await deleteCategory(id);
      setCategories((prev) => prev?.filter((category) => category.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de supprimer la catégorie.",
      );
    }
  }

  return (
    <AdminShell active="/admin/categories">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Catégories d&apos;événement</h1>
        <p className="mt-1 text-sm text-gray-500">
          Liste utilisée par le dropdown de création d&apos;événement côté
          organisateur — désactive une catégorie plutôt que la supprimer si
          elle est déjà utilisée par des événements existants.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-white/5 bg-[#12101c] p-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-violet-200/80">Emoji</span>
          <input
            value={newEmoji}
            onChange={(event) => setNewEmoji(event.target.value)}
            maxLength={8}
            placeholder="🎨"
            className="w-16 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-center text-sm text-white focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-violet-200/80">Code *</span>
          <input
            required
            value={newCode}
            onChange={(event) => setNewCode(event.target.value.toUpperCase())}
            placeholder="EXPOSITION"
            pattern="[A-Z][A-Z0-9_]*"
            title="Majuscules, chiffres et underscore uniquement"
            className="w-40 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-violet-200/80">Libellé *</span>
          <input
            required
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Exposition"
            className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Ajout…" : "+ Ajouter"}
        </button>
      </form>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {categories === undefined ? (
        <p className="text-center text-sm text-gray-500">Chargement…</p>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-10 text-center text-sm text-gray-500">
          Aucune catégorie — ajoute la première ci-dessus.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
          <div className="grid grid-cols-[60px_1fr_90px_auto] gap-3 border-b border-white/5 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span />
            <span>Catégorie</span>
            <span className="text-center">Ordre</span>
            <span />
          </div>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onSave={handleSave}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
