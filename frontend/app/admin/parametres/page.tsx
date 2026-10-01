import { AdminShell } from "@/components/layout/admin-shell";
import { SettingsAccordion } from "@/components/admin/settings-accordion";
import { getT } from "@/lib/i18n/server";

export default async function AdminSettingsPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/parametres">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Paramètres de la plateforme")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Ouvrez la section à modifier. Chaque modification prend effet sur la plateforme et est enregistrée dans le journal d'audit.")}</p>
      </div>

      <SettingsAccordion />
    </AdminShell>
  );
}
