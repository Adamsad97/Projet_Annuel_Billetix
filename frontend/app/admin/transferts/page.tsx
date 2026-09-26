import { AdminShell } from "@/components/layout/admin-shell";
import { TransfersExplorer } from "@/components/admin/transfers-explorer";

export default function AdminTransfersPage() {
  return (
    <AdminShell active="/admin/transferts">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Billets offerts</h1>
        <p className="mt-1 text-sm text-ink-5">
          Historique des transferts de billets entre comptes. Sur appel de l&apos;expéditeur ou à sa demande en
          ligne, un transfert peut être annulé : le billet lui est rendu et le bénéficiaire le perd.
        </p>
      </div>

      <TransfersExplorer />
    </AdminShell>
  );
}
