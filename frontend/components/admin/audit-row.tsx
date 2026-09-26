import type { ApiAuditLogEntry } from "@/lib/api/admin";
import { auditActionLabels } from "@/lib/mappers/audit-mappers";
import { entityTypeBadgeStyles, type AuditEntityType } from "@/lib/mock/admin-audit";

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });

/** Ligne résumée du journal : le détail (contexte, appareil…) s'ouvre via « Consulter ». */
export function AuditRow({ log, onOpen }: { log: ApiAuditLogEntry; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-1 px-5 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-5">{dateTimeFormatter.format(new Date(log.created_at))}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entityTypeBadgeStyles[log.entity_type as AuditEntityType] ?? ""}`}>
          {log.entity_type}
        </span>
        <span className="text-sm font-bold text-ink-1">{auditActionLabels[log.action] ?? log.action}</span>
        <span className="truncate text-xs text-ink-5">· {log.performed_by_email ?? log.performed_by}</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 whitespace-nowrap rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
      >
        Consulter
      </button>
    </div>
  );
}
