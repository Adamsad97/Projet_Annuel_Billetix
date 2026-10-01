import { AdminShell } from "@/components/layout/admin-shell";
import { UsersExplorer } from "@/components/admin/users-explorer";
import { getT } from "@/lib/i18n/server";

export default async function AdminUsersPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/utilisateurs">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Utilisateurs")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Comptes acheteurs, organisateurs et administrateurs de la plateforme.")}</p>
      </div>

      <UsersExplorer />
    </AdminShell>
  );
}
