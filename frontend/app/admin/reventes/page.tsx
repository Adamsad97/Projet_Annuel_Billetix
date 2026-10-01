import { AdminShell } from "@/components/layout/admin-shell";
import { ResalesExplorer } from "@/components/admin/resales-explorer";
import { getT } from "@/lib/i18n/server";

export default async function AdminResalesPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/reventes">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Reventes")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Toutes les annonces de revente : vendeur, acheteur, prix (plafonné à la valeur faciale), dates et statut.")}</p>
      </div>

      <ResalesExplorer />
    </AdminShell>
  );
}
