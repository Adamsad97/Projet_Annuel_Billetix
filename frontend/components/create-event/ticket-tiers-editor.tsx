"use client";

import { useId } from "react";
import type { ApiTicketTierType } from "@/lib/api/ticket-tier-types";

export interface TicketTierRow {
  id: string;
  name: string;
  price: string;
  quota: string;
  maxPerOrder: string;
}

export interface TicketTierInitial {
  name: string;
  price: string;
  quota: string;
  maxPerOrder: string;
}

// Contrôlé par le parent (CreateEventForm) — les lignes doivent être lisibles
// au moment de la soumission pour construire les catégories de billets
// réelles (POST /events/:id/categories).
export function TicketTiersEditor({
  rows,
  onChange,
  tierTypes,
}: {
  rows: TicketTierRow[];
  onChange: (rows: TicketTierRow[]) => void;
  tierTypes: ApiTicketTierType[];
}) {
  const genId = useId();

  function updateRow(id: string, field: keyof TicketTierRow, value: string) {
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    onChange([
      ...rows,
      {
        id: `${genId}-${rows.length}-${Date.now()}`,
        name: tierTypes[0]?.label ?? "",
        price: "",
        quota: "",
        maxPerOrder: "",
      },
    ]);
  }

  function removeRow(id: string) {
    if (rows.length > 1) onChange(rows.filter((row) => row.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[1fr_120px_100px_100px_28px] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid">
        <span>Nom</span>
        <span>Prix HT (€)</span>
        <span>Quota</span>
        <span>Max/cmd</span>
        <span />
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_120px_100px_100px_28px] sm:items-center"
        >
          <select
            value={row.name}
            onChange={(event) => updateRow(row.id, "name", event.target.value)}
            className="col-span-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none sm:col-span-1"
          >
            {tierTypes.length === 0 ? (
              <option value="" className="bg-[#12101c]">Aucun nom disponible</option>
            ) : (
              tierTypes.map((type) => (
                <option key={type.label} value={type.label} className="bg-[#12101c]">
                  {type.emoji ? `${type.emoji} ` : ""}
                  {type.label}
                </option>
              ))
            )}
          </select>
          <input
            type="number"
            value={row.price}
            onChange={(event) => updateRow(row.id, "price", event.target.value)}
            placeholder="Prix"
            min="0"
            step="0.01"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          <input
            type="number"
            value={row.quota}
            onChange={(event) => updateRow(row.id, "quota", event.target.value)}
            placeholder="Quota"
            min="1"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          <input
            type="number"
            value={row.maxPerOrder}
            onChange={(event) => updateRow(row.id, "maxPerOrder", event.target.value)}
            placeholder="Max"
            min="1"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            disabled={rows.length === 1}
            aria-label="Retirer cette catégorie de billet"
            className="justify-self-end text-gray-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 sm:justify-self-center"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="mt-1 rounded-xl border border-dashed border-white/10 py-2.5 text-sm font-medium text-violet-400 transition-colors hover:border-white/20 hover:text-violet-300"
      >
        + Ajouter une catégorie
      </button>
    </div>
  );
}

export function makeInitialTierRows(
  genId: string,
  tierTypes: ApiTicketTierType[],
  initialRows?: TicketTierInitial[],
): TicketTierRow[] {
  const seed = initialRows?.length
    ? initialRows
    : [{ name: tierTypes[0]?.label ?? "", price: "35", quota: "500", maxPerOrder: "4" }];
  return seed.map((row, index) => ({ id: `${genId}-seed-${index}`, ...row }));
}
