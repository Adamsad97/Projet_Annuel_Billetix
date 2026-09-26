import { AdminShell } from "@/components/layout/admin-shell";
import { SettingsAccordion } from "@/components/admin/settings-accordion";

export default function AdminSettingsPage() {
  return (
    <AdminShell active="/admin/parametres">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Paramètres de la plateforme</h1>
        <p className="mt-1 text-sm text-ink-5">
          Ouvrez la section à modifier. Chaque modification prend effet sur la plateforme et est enregistrée dans
          le journal d&apos;audit.
        </p>
      </div>

      <SettingsAccordion />
    </AdminShell>
  );
}
