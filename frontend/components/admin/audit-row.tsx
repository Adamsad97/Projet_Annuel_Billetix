import { entityTypeBadgeStyles, type AuditEntry } from "@/lib/mock/admin-audit";

export function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-gray-500">
            {entry.timestampLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${entityTypeBadgeStyles[entry.entityType]}`}
          >
            {entry.entityType}
          </span>
          <span className="text-sm font-bold text-white">{entry.action}</span>
          <span className="text-sm text-gray-400">· {entry.entityLabel}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{entry.reason}</p>
      </div>

      <span className="shrink-0 text-xs text-gray-600">{entry.performedBy}</span>
    </div>
  );
}
