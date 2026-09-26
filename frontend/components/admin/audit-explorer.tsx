"use client";

// Bug corrigé : page 100% maquette (entrées factices) — les vraies actions
// (billets offerts, accès aux billets, décisions admin…) étaient bien
// journalisées par l'admin-service mais jamais affichées. Câblée sur
// GET /admin/audit-logs (filtres et recherche côté serveur).

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { AuditRow } from "@/components/admin/audit-row";
import { searchAuditLogs, type ApiAuditLogEntry } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { auditActionFilters } from "@/lib/mappers/audit-mappers";
import { entityTypeFilters } from "@/lib/mock/admin-audit";

const PAGE_SIZE = 30;

export function AuditExplorer() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);
  const [logs, setLogs] = useState<ApiAuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      searchAuditLogs({
        q: search.trim() || undefined,
        entity_type: entityType === "all" ? undefined : entityType,
        action: action === "all" ? undefined : action,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
        .then((result) => {
          setLogs(result.logs);
          setTotal(result.total);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger le journal."));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, entityType, action, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={entityTypeFilters} active={entityType} onChange={resetPage(setEntityType)} />
        <SearchInput
          value={search}
          onChange={resetPage(setSearch)}
          placeholder="Email, référence de billet, IP…"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={auditActionFilters} active={action} onChange={resetPage(setAction)} />
        <p className="text-sm text-ink-5">
          {total} entrée{total > 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {logs === null ? (
          <p className="px-5 py-8 text-center text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : logs.length > 0 ? (
          logs.map((log) => <AuditRow key={log.id} log={log} />)
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Aucune entrée ne correspond à cette recherche.</p>
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-ink-5">
            Page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      ) : null}
    </div>
  );
}
