import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { EventsExplorer } from "@/components/admin/events-explorer";

export default function AdminEventsPage() {
  return (
    <AdminShell active="/admin/evenements">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Événements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue d&apos;ensemble de tous les événements de la plateforme, tous statuts confondus.
          </p>
        </div>
        <Link
          href="/admin/evenements/creer"
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          + Créer pour un organisateur
        </Link>
      </div>

      <EventsExplorer />
    </AdminShell>
  );
}
