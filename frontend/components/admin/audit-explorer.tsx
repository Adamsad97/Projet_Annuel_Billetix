"use client";

// Journal d'audit réel (GET /admin/audit-logs), filtres et recherche côté serveur.

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { AuditRow } from "@/components/admin/audit-row";
import { DetailDialog, DetailSection } from "@/components/ui/detail-dialog";
import { getStoredUser } from "@/lib/auth/session";
import { describeDevice, formatIp } from "@/lib/format/device";
import { searchAuditLogs, type ApiAuditLogEntry } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { auditActionFilters, auditActionLabels, describeAuditLog } from "@/lib/mappers/audit-mappers";
import { entityTypeFilters } from "@/lib/constants/admin-audit";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 30;
const dateTimeFull = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "medium" });

export function AuditExplorer() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);
  const [logs, setLogs] = useState<ApiAuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiAuditLogEntry | null>(null);
  // Recherche par IP : super admin uniquement (le serveur l'applique aussi).
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSuperAdmin(getStoredUser()?.role === "SUPER_ADMIN");
  }, []);

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
          placeholder={isSuperAdmin ? "Email, référence de billet, IP…" : "Email, référence de billet…"}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={auditActionFilters} active={action} onChange={resetPage(setAction)} />
        <p className="text-sm text-ink-5">
          {total} entrée{total > 1 ? "s" : ""}
        </p>
      </div>

      <div className={cardClass("overflow-hidden")}>
        {logs === null ? (
          <MutedMessage variant="list">{error ?? "Chargement…"}</MutedMessage>
        ) : logs.length > 0 ? (
          logs.map((log) => <AuditRow key={log.id} log={log} onOpen={() => setSelected(log)} />)
        ) : (
          <MutedMessage variant="list">Aucune entrée ne correspond à cette recherche.</MutedMessage>
        )}
      </div>

      <Pagination page={page + 1} pageCount={pageCount} onChange={(next) => setPage(next - 1)} />
      <DetailDialog
        open={selected !== null}
        title={selected ? auditActionLabels[selected.action] ?? selected.action : ""}
        subtitle={selected ? dateTimeFull.format(new Date(selected.created_at)) : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <DetailSection title="Détails">
              <p className="break-words">{describeAuditLog(selected)}</p>
            </DetailSection>
            {selected.reason ? (
              <DetailSection title="Motif">
                <p className="break-words">« {selected.reason} »</p>
              </DetailSection>
            ) : null}
            <DetailSection title="Effectuée par">
              <p>{selected.performed_by_email ?? selected.performed_by}</p>
            </DetailSection>
            <DetailSection title="Élément concerné">
              <p>
                {selected.entity_type}
                {selected.entity_id ? ` · ${selected.entity_id}` : ""}
              </p>
            </DetailSection>
            <DetailSection title="Contexte">
              <p>Appareil : {describeDevice(typeof selected.metadata?.user_agent === "string" ? selected.metadata.user_agent : null)}</p>
              {selected.ip_address !== undefined ? <p>Adresse IP : {formatIp(selected.ip_address)}</p> : null}
            </DetailSection>
          </>
        ) : null}
      </DetailDialog>
    </div>
  );
}
