import { AdminShell } from "@/components/layout/admin-shell";
import { FeeGridTable } from "@/components/admin/fee-grid-table";
import { getT } from "@/lib/i18n/server";

export default async function AdminCommissionsPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/commissions">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Commissions")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Barème appliqué aux ventes : commission de la plateforme et frais des moyens de paiement. Modifiable depuis Paramètres.")}</p>
      </div>

      <FeeGridTable />
    </AdminShell>
  );
}
