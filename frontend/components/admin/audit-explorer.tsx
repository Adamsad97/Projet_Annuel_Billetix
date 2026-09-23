"use client";

import { useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { AuditRow } from "@/components/admin/audit-row";
import {
  auditEntries,
  entityTypeFilters,
  type AuditEntityType,
} from "@/lib/mock/admin-audit";

export function AuditExplorer() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");

  const filtered = useMemo(() => {
    return auditEntries.filter((entry) => {
      const matchesType =
        entityType === "all" || entry.entityType === (entityType as AuditEntityType);
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        entry.action.toLowerCase().includes(query) ||
        entry.entityLabel.toLowerCase().includes(query) ||
        entry.performedBy.toLowerCase().includes(query) ||
        entry.reason.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [search, entityType]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={entityTypeFilters} active={entityType} onChange={setEntityType} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une action, une entité, un auteur…"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {filtered.length > 0 ? (
          filtered.map((entry) => <AuditRow key={entry.id} entry={entry} />)
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            Aucune entrée ne correspond à cette recherche.
          </p>
        )}
      </div>
    </div>
  );
}
