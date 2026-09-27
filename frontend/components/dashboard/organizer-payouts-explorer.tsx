"use client";

// Reversements de l'organisateur : recherche par événement, filtre par
// statut et tri par date prévue ou montant.

import { useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { FinanceRow } from "@/components/dashboard/finance-row";
import { SearchField } from "@/components/ui/search-field";
import type { ApiPayout, ApiPayoutStatus } from "@/lib/api/organizer";
import { matchesSearch } from "@/lib/format/search";

type SortOrder = "scheduled_desc" | "scheduled_asc" | "amount";

const STATUS_OPTIONS: { id: "all" | ApiPayoutStatus; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "PENDING", label: "En attente" },
  { id: "PROCESSING", label: "En cours" },
  { id: "COMPLETED", label: "Versés" },
  { id: "BLOCKED", label: "Bloqués" },
  { id: "FAILED", label: "Échoués" },
];

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "scheduled_desc", label: "Date prévue (récente)" },
  { id: "scheduled_asc", label: "Date prévue (ancienne)" },
  { id: "amount", label: "Montant net" },
];

export function OrganizerPayoutsExplorer({
  payouts,
  busyId,
  onRequestEarly,
}: {
  payouts: ApiPayout[];
  busyId: string | null;
  onRequestEarly: (payoutId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ApiPayoutStatus>("all");
  const [sort, setSort] = useState<SortOrder>("scheduled_desc");

  const searched = useMemo(
    () => payouts.filter((payout) => matchesSearch(search, payout.event_title, payout.event_venue_name)),
    [payouts, search],
  );

  const filtered = useMemo(() => {
    const list = status === "all" ? searched : searched.filter((payout) => payout.status === status);
    return [...list].sort((a, b) => {
      if (sort === "amount") return Number(b.net_amount) - Number(a.net_amount);
      const diff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      return sort === "scheduled_asc" ? diff : -diff;
    });
  }, [searched, status, sort]);

  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: option.id === "all" ? searched.length : searched.filter((payout) => payout.status === option.id).length,
  })).filter((option) => option.id === "all" || option.count > 0 || option.id === status);

  if (payouts.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline-1 bg-card px-5 py-10 text-center text-sm text-ink-5">
        Aucun reversement pour le moment.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher un événement…" className="w-full sm:max-w-sm" />
        <label className="flex items-center gap-2 text-sm text-ink-5">
          Trier par
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOrder)}
            className="h-10 rounded-full border border-hairline-3 bg-card px-4 text-sm font-medium text-ink-2 focus:border-blue-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FilterPills options={statusOptions} active={status} onChange={(id) => setStatus(id as "all" | ApiPayoutStatus)} />

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {filtered.length > 0 ? (
          filtered.map((payout) => (
            <FinanceRow key={payout.id} payout={payout} onRequestEarly={onRequestEarly} busy={busyId === payout.id} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-ink-5">Aucun reversement ne correspond à ces critères.</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
              className="text-sm font-medium text-link hover:text-link-hover"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
