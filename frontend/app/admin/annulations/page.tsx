import { AdminShell } from "@/components/layout/admin-shell";
import { CancellationRequestsExplorer } from "@/components/admin/cancellation-requests-explorer";

export default function AdminCancellationsPage() {
  return (
    <AdminShell active="/admin/annulations">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Demandes d&apos;annulation et de report</h1>
        <p className="mt-1 text-sm text-ink-5">
          Un organisateur ne peut ni annuler ni reporter seul son événement : chaque demande est acceptée ou refusée ici, après
          échange si besoin.
        </p>
      </div>

      <CancellationRequestsExplorer />
    </AdminShell>
  );
}
