import { AdminShell } from "@/components/layout/admin-shell";
import { SettingsSectionCard } from "@/components/admin/settings-section";
import { settingsSections } from "@/lib/mock/admin-settings";

export default function AdminSettingsPage() {
  return (
    <AdminShell active="/admin/parametres">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Paramètres de la plateforme</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chaque valeur ajustable ici correspond à une clé configurable de
          platform_settings — aucune constante codée en dur côté services.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {settingsSections.map((section) => (
          <SettingsSectionCard key={section.id} section={section} />
        ))}
      </div>
    </AdminShell>
  );
}
