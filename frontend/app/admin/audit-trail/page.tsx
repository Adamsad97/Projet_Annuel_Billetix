import { AdminShell } from "@/components/layout/admin-shell";
import { AuditExplorer } from "@/components/admin/audit-explorer";

export default function AdminAuditTrailPage() {
  return (
    <AdminShell active="/admin/audit-trail">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit trail</h1>
        <p className="mt-1 text-sm text-gray-500">
          Historique complet des actions administratives et automatiques sur la plateforme.
        </p>
      </div>

      <AuditExplorer />
    </AdminShell>
  );
}
