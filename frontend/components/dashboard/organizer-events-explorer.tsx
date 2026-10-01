"use client";

// « Mes événements » (organisateur) : recherche par titre ou lieu, filtre par
// état (à venir, brouillons, en validation, passés, annulés) et tri.

import { useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { OrganizerEventRow } from "@/components/dashboard/organizer-event-row";
import { SearchField } from "@/components/ui/search-field";
import type { ApiCategory } from "@/lib/api/categories";
import type { ApiOrganizerEventSummary } from "@/lib/api/organizer";
import { matchesSearch } from "@/lib/format/search";
import { apiEventSummaryToOrganizerEvent } from "@/lib/mappers/dashboard-mappers";
import { cardClass } from "@/components/ui/card";
import { filterSelectClass } from "@/components/ui/field";
import { t, msg } from "@/lib/i18n/translate";

type Group = "all" | "live" | "postponed" | "draft" | "pending" | "hidden" | "past" | "cancelled";
type SortOrder = "upcoming" | "latest" | "revenue" | "title";

const GROUPS: { id: Group; label: string; statuses: string[] }[] = [
  { id: "all", label: msg("Tous"), statuses: [] },
  { id: "live", label: msg("En vente"), statuses: ["PUBLISHED"] },
  { id: "postponed", label: msg("Reportés"), statuses: ["POSTPONED"] },
  { id: "draft", label: msg("Brouillons"), statuses: ["DRAFT"] },
  { id: "pending", label: msg("En validation"), statuses: ["PENDING_VALIDATION"] },
  { id: "hidden", label: msg("Masqués au public"), statuses: [] },
  { id: "past", label: msg("Terminés"), statuses: ["TERMINATED", "ARCHIVED"] },
  { id: "cancelled", label: msg("Annulés ou désactivés"), statuses: ["CANCELLED", "SUSPENDED"] },
];

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "upcoming", label: msg("Date la plus proche") },
  { id: "latest", label: msg("Date la plus lointaine") },
  { id: "revenue", label: msg("Chiffre d'affaires") },
  { id: "title", label: msg("Titre (A → Z)") },
];

export function OrganizerEventsExplorer({
  events,
  categoriesByCode,
}: {
  events: ApiOrganizerEventSummary[];
  categoriesByCode: Map<string, ApiCategory>;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [sort, setSort] = useState<SortOrder>("upcoming");

  const searched = useMemo(
    () => events.filter((event) => matchesSearch(search, event.title, event.venue_name, event.venue_city)),
    [events, search],
  );

  const filtered = useMemo(() => {
    const statuses = GROUPS.find((g) => g.id === group)?.statuses ?? [];
    const list =
      group === "hidden"
        ? searched.filter((event) => event.is_hidden)
        : statuses.length
          ? searched.filter((event) => statuses.includes(event.status))
          : searched;
    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "fr");
      if (sort === "revenue") return b.revenue_ttc - a.revenue_ttc;
      const diff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      return sort === "upcoming" ? diff : -diff;
    });
  }, [searched, group, sort]);

  // Onglets vides masqués (sauf « Tous ») : pas de filtre qui ne mène à rien.
  const groupOptions = GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    count:
      g.id === "hidden"
        ? searched.filter((event) => event.is_hidden).length
        : g.statuses.length
          ? searched.filter((event) => g.statuses.includes(event.status)).length
          : searched.length,
  })).filter((option) => option.id === "all" || option.count > 0 || option.id === group);

  if (events.length === 0) {
    return (
      <div className={cardClass("px-5 py-10 text-center text-sm text-ink-5")}>{t("Vous n'avez encore créé aucun événement.")}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("Titre, lieu ou ville…")}
          className="w-full sm:max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-5">{t("Trier par")}<select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOrder)}
            className={filterSelectClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FilterPills options={groupOptions} active={group} onChange={(id) => setGroup(id as Group)} />

      <div className={cardClass("overflow-hidden")}>
        {filtered.length > 0 ? (
          filtered.map((event) => (
            <OrganizerEventRow key={event.id} event={apiEventSummaryToOrganizerEvent(event, categoriesByCode)} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-ink-5">{t("Aucun événement ne correspond à ces critères.")}</p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setGroup("all");
              }}
              className="text-sm font-medium text-link hover:text-link-hover"
            >{t("Réinitialiser")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
