import { AdminShell } from "@/components/layout/admin-shell";
import { UsersExplorer } from "@/components/admin/users-explorer";

export default function AdminUsersPage() {
  return (
    <AdminShell active="/admin/utilisateurs">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Utilisateurs</h1>
        <p className="mt-1 text-sm text-ink-5">
          Comptes acheteurs, organisateurs et administrateurs de la plateforme.
        </p>
      </div>

      <UsersExplorer />
    </AdminShell>
  );
}
