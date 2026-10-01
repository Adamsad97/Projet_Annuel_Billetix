import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { EventsExplorer } from "@/components/admin/events-explorer";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function AdminEventsPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/evenements">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-1">{t("Événements")}</h1>
          <p className="mt-1 text-sm text-ink-5">{t("Vue d'ensemble de tous les événements de la plateforme, tous statuts confondus.")}</p>
        </div>
        <Link
          href="/admin/evenements/creer"
          className={buttonClass("primary", "rounded-full px-5 py-2.5 text-sm")}
        >{t("+ Créer pour un organisateur")}</Link>
      </div>

      <EventsExplorer />
    </AdminShell>
  );
}
