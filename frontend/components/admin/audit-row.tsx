import type { ApiAuditLogEntry } from "@/lib/api/admin";
import { auditActionLabels, describeAuditLog } from "@/lib/mappers/audit-mappers";
import { entityTypeBadgeStyles, type AuditEntityType } from "@/lib/mock/admin-audit";

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });

export function AuditRow({ log }: { log: ApiAuditLogEntry }) {
  const userAgent = typeof log.metadata?.user_agent === "string" ? log.metadata.user_agent : null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-5">{dateTimeFormatter.format(new Date(log.created_at))}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entityTypeBadgeStyles[log.entity_type as AuditEntityType] ?? ""}`}>
            {log.entity_type}
          </span>
          <span className="text-sm font-bold text-ink-1">{auditActionLabels[log.action] ?? log.action}</span>
        </div>
        <p className="mt-1 break-words text-xs text-ink-4">{describeAuditLog(log)}</p>
        {log.ip_address || userAgent ? (
          <p className="mt-0.5 truncate text-xs text-ink-6" title={userAgent ?? undefined}>
            {log.ip_address ? `IP ${log.ip_address}` : null}
            {log.ip_address && userAgent ? " · " : null}
            {userAgent}
          </p>
        ) : null}
      </div>

      <span className="shrink-0 text-xs text-ink-5">{log.performed_by_email ?? log.performed_by}</span>
    </div>
  );
}
