import { AdminShell } from "@/components/layout/admin-shell";
import { DisputesExplorer } from "@/components/admin/disputes-explorer";

export default function AdminDisputesPage() {
  return (
    <AdminShell active="/admin/litiges">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Litiges</h1>
        <p className="mt-1 text-sm text-gray-500">
          Réclamations, contestations bancaires et remboursements en cours de traitement.
        </p>
      </div>

      <DisputesExplorer />
    </AdminShell>
  );
}
