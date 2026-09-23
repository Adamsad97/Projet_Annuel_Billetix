import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { FeeGridTable } from "@/components/admin/fee-grid-table";
import { commissionStats } from "@/lib/mock/admin-commissions";

export default function AdminCommissionsPage() {
  return (
    <AdminShell active="/admin/commissions">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Commissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Barème de frais appliqué par moyen de paiement. Modifiable depuis
          Paramètres.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {commissionStats.map((stat) => (
          <AdminStatCard key={stat.label} stat={{ id: stat.label, ...stat }} />
        ))}
      </div>

      <FeeGridTable />
    </AdminShell>
  );
}
