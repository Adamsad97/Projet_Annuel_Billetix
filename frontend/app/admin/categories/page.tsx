"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { CategoryRow } from "@/components/admin/category-row";
import { TicketTierTypeRow } from "@/components/admin/ticket-tier-type-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  updateCategory,
  type ApiCategory,
} from "@/lib/api/categories";
import {
  createTicketTierType,
  deleteTicketTierType,
  listAllTicketTierTypes,
  updateTicketTierType,
  type ApiTicketTierType,
} from "@/lib/api/ticket-tier-types";
import { ApiError } from "@/lib/api/http-error";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ApiCategory[] | undefined>(undefined);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [tierTypes, setTierTypes] = useState<ApiTicketTierType[] | undefined>(undefined);
  const [tierTypesError, setTierTypesError] = useState<string | null>(null);
  const [newTierLabel, setNewTierLabel] = useState("");
  const [newTierEmoji, setNewTierEmoji] = useState("");
  const [creatingTierType, setCreatingTierType] = useState(false);

  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  useEffect(() => {
    listAllCategories()
      .then(setCategories)
      .catch((err) => setCategoriesError(err instanceof ApiError ? err.message : "Impossible de charger les catégories."));
    listAllTicketTierTypes()
      .then(setTierTypes)
      .catch((err) => setTierTypesError(err instanceof ApiError ? err.message : "Impossible de charger les noms de catégorie de billet."));
  }, []);

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoriesError(null);
    setCreatingCategory(true);
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
      setCategoriesError(err instanceof ApiError ? err.message : "Impossible de créer la catégorie.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSaveCategory(id: string, dto: { label: string; emoji: string; display_order: number }) {
    setCategoriesError(null);
    try {
      const updated = await updateCategory(id, { label: dto.label, emoji: dto.emoji || undefined, display_order: dto.display_order });
      setCategories((prev) => prev?.map((category) => (category.id === id ? updated : category)));
    } catch (err) {
      setCategoriesError(err instanceof ApiError ? err.message : "Impossible de modifier la catégorie.");
    }
  }

  async function handleToggleCategoryActive(id: string, isActive: boolean) {
    setCategoriesError(null);
    try {
      const updated = await updateCategory(id, { is_active: isActive });
      setCategories((prev) => prev?.map((category) => (category.id === id ? updated : category)));
    } catch (err) {
      setCategoriesError(err instanceof ApiError ? err.message : "Impossible de modifier la catégorie.");
    }
  }

  function handleDeleteCategory(id: string) {
    setDialog({
      title: "Supprimer cette catégorie ?",
      message: "Définitif — impossible si elle est déjà utilisée par un événement (désactive-la plutôt dans ce cas).",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        setCategoriesError(null);
        try {
          await deleteCategory(id);
          setCategories((prev) => prev?.filter((category) => category.id !== id));
        } catch (err) {
          setCategoriesError(err instanceof ApiError ? err.message : "Impossible de supprimer la catégorie.");
        }
      },
    });
  }

  async function handleCreateTierType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTierTypesError(null);
    setCreatingTierType(true);
    try {
      const created = await createTicketTierType({
        label: newTierLabel.trim(),
        emoji: newTierEmoji.trim() || undefined,
        display_order: (tierTypes?.length ?? 0) + 1,
      });
      setTierTypes((prev) => [...(prev ?? []), created]);
      setNewTierLabel("");
      setNewTierEmoji("");
    } catch (err) {
      setTierTypesError(err instanceof ApiError ? err.message : "Impossible de créer ce nom de catégorie de billet.");
    } finally {
      setCreatingTierType(false);
    }
  }

  async function handleSaveTierType(id: string, dto: { label: string; emoji: string; display_order: number }) {
    setTierTypesError(null);
    try {
      const updated = await updateTicketTierType(id, { label: dto.label, emoji: dto.emoji || undefined, display_order: dto.display_order });
      setTierTypes((prev) => prev?.map((type) => (type.id === id ? updated : type)));
    } catch (err) {
      setTierTypesError(err instanceof ApiError ? err.message : "Impossible de modifier ce nom de catégorie de billet.");
    }
  }

  async function handleToggleTierTypeActive(id: string, isActive: boolean) {
    setTierTypesError(null);
    try {
      const updated = await updateTicketTierType(id, { is_active: isActive });
      setTierTypes((prev) => prev?.map((type) => (type.id === id ? updated : type)));
    } catch (err) {
      setTierTypesError(err instanceof ApiError ? err.message : "Impossible de modifier ce nom de catégorie de billet.");
    }
  }

  function handleDeleteTierType(id: string) {
    setDialog({
      title: "Supprimer ce nom de catégorie de billet ?",
      message: "Définitif — impossible s'il est déjà utilisé par une catégorie de billet (désactive-le plutôt dans ce cas).",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        setTierTypesError(null);
        try {
          await deleteTicketTierType(id);
          setTierTypes((prev) => prev?.filter((type) => type.id !== id));
        } catch (err) {
          setTierTypesError(err instanceof ApiError ? err.message : "Impossible de supprimer ce nom de catégorie de billet.");
        }
      },
    });
  }

  return (
    <AdminShell active="/admin/categories">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Catégories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ces deux listes alimentent les dropdowns du formulaire de création
          d&apos;événement côté organisateur — désactive une entrée plutôt que
          la supprimer si elle est déjà utilisée.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-white">Catégories d&apos;événement</h2>

        <form
          onSubmit={handleCreateCategory}
          className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/5 bg-[#12101c] p-4"
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
            disabled={creatingCategory}
            className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creatingCategory ? "Ajout…" : "+ Ajouter"}
          </button>
        </form>

        {categoriesError ? (
          <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {categoriesError}
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
                onSave={handleSaveCategory}
                onToggleActive={handleToggleCategoryActive}
                onDelete={handleDeleteCategory}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Catégories de billets</h2>
        <p className="mb-3 text-sm text-gray-500">
          Noms disponibles quand un organisateur ajoute une catégorie de
          billet à son événement (ex: Standard, VIP) — plus de saisie libre.
        </p>

        <form
          onSubmit={handleCreateTierType}
          className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/5 bg-[#12101c] p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-violet-200/80">Emoji</span>
            <input
              value={newTierEmoji}
              onChange={(event) => setNewTierEmoji(event.target.value)}
              maxLength={8}
              placeholder="🎟️"
              className="w-16 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-center text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-violet-200/80">Nom *</span>
            <input
              required
              value={newTierLabel}
              onChange={(event) => setNewTierLabel(event.target.value)}
              placeholder="Early Bird"
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={creatingTierType}
            className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creatingTierType ? "Ajout…" : "+ Ajouter"}
          </button>
        </form>

        {tierTypesError ? (
          <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {tierTypesError}
          </p>
        ) : null}

        {tierTypes === undefined ? (
          <p className="text-center text-sm text-gray-500">Chargement…</p>
        ) : tierTypes.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-10 text-center text-sm text-gray-500">
            Aucun nom — ajoute le premier ci-dessus.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
            <div className="grid grid-cols-[60px_1fr_90px_auto] gap-3 border-b border-white/5 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <span />
              <span>Nom</span>
              <span className="text-center">Ordre</span>
              <span />
            </div>
            {tierTypes.map((type) => (
              <TicketTierTypeRow
                key={type.id}
                type={type}
                onSave={handleSaveTierType}
                onToggleActive={handleToggleTierTypeActive}
                onDelete={handleDeleteTierType}
              />
            ))}
          </div>
        )}
      </section>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
