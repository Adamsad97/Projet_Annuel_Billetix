"use client";

import { useId } from "react";
import type { PricingPolicy } from "@/lib/api/events";
import type { ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import { commissionPercentFor, computePriceBreakdown } from "@/lib/pricing/price-breakdown";
import { euros } from "@/lib/format/money";
import { formatVatPercent } from "@/lib/api/vat-rates";
import { fieldClass } from "@/components/ui/field";

/** Détail d'un prix saisi : ce que paie le client et ce que perçoit l'organisateur. */
function PriceDetail({ price, pricing, commissionPercent }: { price: string; pricing: PricingPolicy; commissionPercent: number }) {
  const value = Number(price);
  if (price.trim() === "" || !Number.isFinite(value) || value < 0) return null;
  const detail = computePriceBreakdown(value, pricing, commissionPercent);

  if (detail.priceHt === 0) {
    return (
      <div className="col-span-2 rounded-xl bg-hairline-1 px-4 py-3 text-xs text-ink-4 sm:col-span-5">
        <p className="text-sm font-semibold text-ink-1">Billet gratuit pour le client</p>
        <p className="mt-1">
          Frais de {euros.format(detail.freeTicketFee)} par billet à votre charge, déduits de vos reversements.
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-2 grid gap-x-6 gap-y-1 rounded-xl bg-hairline-1 px-4 py-3 text-xs text-ink-4 sm:col-span-5 sm:grid-cols-2">
      <div>
        <p className="flex justify-between gap-3">
          <span>Votre prix HT</span>
          <span>{euros.format(detail.priceHt)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>+ TVA {formatVatPercent(pricing.tva_rate)}</span>
          <span>{euros.format(detail.vat)}</span>
        </p>
        <p className="mt-1 flex justify-between gap-3 border-t border-hairline-2 pt-1 text-sm font-semibold text-ink-1">
          <span>Prix affiché et payé par le client</span>
          <span>{euros.format(detail.priceTtc)}</span>
        </p>
      </div>
      <div className="mt-2 sm:mt-0">
        <p className="flex justify-between gap-3">
          <span>Commission BilleTix {commissionPercent} % (sur le HT)</span>
          <span>− {euros.format(detail.commission)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>Frais de paiement (environ)</span>
          <span>− {euros.format(detail.paymentFees)}</span>
        </p>
        <p className="mt-1 flex justify-between gap-3 border-t border-hairline-2 pt-1 text-sm font-semibold text-ink-1">
          <span>Vous recevez par billet</span>
          <span>≈ {euros.format(detail.organizerNet)}</span>
        </p>
      </div>
    </div>
  );
}

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

// Contrôlé par le parent, qui construit les catégories de billets à la soumission.
export function TicketTiersEditor({
  rows,
  onChange,
  tierTypes,
  totalCapacity,
  pricing = null,
  free = false,
}: {
  rows: TicketTierRow[];
  onChange: (rows: TicketTierRow[]) => void;
  tierTypes: ApiTicketTierType[];
  // Taux des réglages admin : détail du prix sous chaque catégorie (null
  // tant qu'ils ne sont pas chargés — la saisie reste possible).
  pricing?: PricingPolicy | null;
  // Somme des quotas plafonnée à la capacité, visible en temps réel.
  totalCapacity: number;
  // Événement gratuit : prix fixé à 0 sur chaque catégorie, non saisissable.
  free?: boolean;
}) {
  const genId = useId();
  const commissionPercent = pricing ? commissionPercentFor(pricing, totalCapacity) : 0;

  const totalQuota = rows.reduce((sum, row) => sum + (parseInt(row.quota, 10) || 0), 0);
  const overCapacity = totalCapacity > 0 && totalQuota > totalCapacity;

  // Chaque ligne ne propose que les noms encore disponibles, plus le sien.
  const usedNames = new Set(rows.map((row) => row.name).filter(Boolean));
  const availableForNewRow = tierTypes.filter((type) => !usedNames.has(type.label));

  function updateRow(id: string, field: keyof TicketTierRow, value: string) {
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    onChange([
      ...rows,
      {
        id: `${genId}-${rows.length}-${Date.now()}`,
        name: availableForNewRow[0]?.label ?? "",
        price: free ? "0" : "",
        quota: "",
        maxPerOrder: "",
      },
    ]);
  }

  function removeRow(id: string) {
    if (rows.length > 1) onChange(rows.filter((row) => row.id !== id));
  }

  const freeTicketFee = pricing ? computePriceBreakdown(0, pricing, commissionPercent).freeTicketFee : null;

  return (
    <div className="flex flex-col gap-3">
      {free ? (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-xs text-ink-3 ring-1 ring-inset ring-emerald-500/30">
          <p className="text-sm font-semibold text-ink-1">Entrée gratuite pour le public</p>
          <p className="mt-1">
            Les participants réservent leur billet sans payer.
            {freeTicketFee !== null && freeTicketFee > 0
              ? ` Frais de ${euros.format(freeTicketFee)} par billet à votre charge, déduits de vos reversements.`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="hidden grid-cols-[1fr_120px_100px_100px_28px] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-ink-5 sm:grid">
        <span>Nom</span>
        <span>{free ? "Prix" : "Prix HT (€)"}</span>
        <span>Quota</span>
        <span>Max/cmd</span>
        <span />
      </div>

      {rows.map((row) => {
        const optionsForRow = tierTypes.filter(
          (type) => type.label === row.name || !usedNames.has(type.label),
        );
        const otherRowsQuota = rows
          .filter((other) => other.id !== row.id)
          .reduce((sum, other) => sum + (parseInt(other.quota, 10) || 0), 0);
        const maxForRow = totalCapacity > 0 ? Math.max(totalCapacity - otherRowsQuota, 0) : undefined;
        return (
          <div
            key={row.id}
            className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_120px_100px_100px_28px] sm:items-center"
          >
            <select
              value={row.name}
              onChange={(event) => updateRow(row.id, "name", event.target.value)}
              className={fieldClass("col-span-2 px-3 py-2.5 sm:col-span-1")}
            >
              {optionsForRow.length === 0 ? (
                <option value="" className="bg-card">Aucun nom disponible</option>
              ) : (
                optionsForRow.map((type) => (
                  <option key={type.label} value={type.label} className="bg-card">
                    {type.emoji ? `${type.emoji} ` : ""}
                    {type.label}
                  </option>
                ))
              )}
            </select>
            {free ? (
              <span className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-center text-sm font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/30">
                Gratuit
              </span>
            ) : (
              <input
                type="number"
                value={row.price}
                onChange={(event) => updateRow(row.id, "price", event.target.value)}
                placeholder="Prix"
                min="0"
                step="0.01"
                aria-label={`Prix HT de la catégorie ${row.name}`}
                className={fieldClass("px-3 py-2.5")}
              />
            )}
            <input
              type="number"
              value={row.quota}
              onChange={(event) => updateRow(row.id, "quota", event.target.value)}
              placeholder="Quota"
              min="1"
              max={maxForRow}
              className={fieldClass("px-3 py-2.5")}
            />
            <input
              type="number"
              value={row.maxPerOrder}
              onChange={(event) => updateRow(row.id, "maxPerOrder", event.target.value)}
              placeholder="Max"
              min="1"
              className={fieldClass("px-3 py-2.5")}
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1}
              aria-label="Retirer cette catégorie de billet"
              className="justify-self-end text-ink-5 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 sm:justify-self-center"
            >
              ✕
            </button>
            {pricing && !free ? <PriceDetail price={row.price} pricing={pricing} commissionPercent={commissionPercent} /> : null}
          </div>
        );
      })}

      {pricing && !free ? (
        <p className="text-center text-xs text-ink-5">
          Le prix affiché aux clients inclut la TVA. « Vous recevez » est une estimation : les frais de
          paiement réels dépendent du montant de chaque commande.
          {totalCapacity > pricing.large_event_threshold
            ? ` Commission réduite à ${pricing.commission_large_event_percent} % : plus de ${pricing.large_event_threshold} places.`
            : ""}
        </p>
      ) : null}

      {totalCapacity > 0 ? (
        <p className={overCapacity ? "text-center text-xs font-medium text-red-400" : "text-center text-xs text-ink-5"}>
          {totalQuota} / {totalCapacity} places réparties
          {overCapacity ? ` — dépasse la capacité totale de ${totalQuota - totalCapacity}` : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={addRow}
        disabled={availableForNewRow.length === 0}
        className="mt-1 rounded-xl border border-dashed border-hairline-2 py-2.5 text-sm font-medium text-link transition-colors hover:border-hairline-4 hover:text-link-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline-2 disabled:hover:text-link"
      >
        + Ajouter une catégorie
      </button>
      {tierTypes.length > 0 && availableForNewRow.length === 0 ? (
        <p className="text-center text-xs text-ink-5">
          Tous les noms disponibles sont déjà utilisés — demandez à un administrateur d&apos;en ajouter un si besoin.
        </p>
      ) : null}
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
