import { AdminShell } from "@/components/layout/admin-shell";
import { DisputesExplorer } from "@/components/admin/disputes-explorer";
import { getT } from "@/lib/i18n/server";

export default async function AdminDisputesPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/litiges">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Litiges")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Réclamations, contestations bancaires et remboursements en cours de traitement.")}</p>
      </div>

      <DisputesExplorer />
    </AdminShell>
  );
}
