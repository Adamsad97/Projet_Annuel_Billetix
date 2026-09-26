import { AdminShell } from "@/components/layout/admin-shell";
import { AuditExplorer } from "@/components/admin/audit-explorer";

export default function AdminAuditTrailPage() {
  return (
    <AdminShell active="/admin/audit-trail">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Audit trail</h1>
        <p className="mt-1 text-sm text-ink-5">
          Historique des actions administratives et sensibles : décisions admin, accès aux billets,
          billets offerts entre comptes (qui, quand, adresse IP, appareil).
        </p>
      </div>

      <AuditExplorer />
    </AdminShell>
  );
}
