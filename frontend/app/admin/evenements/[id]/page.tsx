import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid } from "@/components/admin/document-viewer";
import { adminEvents, eventStatusBadge } from "@/lib/mock/admin-events";

export function generateStaticParams() {
  return adminEvents.map((event) => ({ id: event.id }));
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = adminEvents.find((e) => e.id === id);

  if (!event) {
    notFound();
  }

  const badge = eventStatusBadge[event.status];

  return (
    <AdminShell active="/admin/evenements">
      <Link
        href="/admin/evenements"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
      >
        ← Événements
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${event.iconBg}`}>
            {event.emoji}
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">{event.title}</h1>
            <p className="text-sm text-gray-500">
              {event.organizer} · {event.category} · {event.dateLabel}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
              <span className="text-sm text-gray-400">{event.ticketsLabel} billets</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/evenements/${event.id}`}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
          >
            Voir la page publique →
          </Link>
          {event.status === "published" ? (
            <button
              type="button"
              className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25"
            >
              Dépublier
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/5 bg-[#12101c] p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-200">Documents soumis</h2>
        <DocumentGrid
          documents={[
            {
              id: "poster",
              label: "Affiche de l'événement",
              // Page pas encore câblée sur le backend (cf. /admin/evenements) —
              // pas de vraie affiche à afficher pour l'instant.
              url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%2312101c'/%3E%3C/svg%3E",
            },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-200">Note de modération</h2>
        <textarea
          rows={3}
          placeholder="Ajouter une note interne sur cet événement…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
      </div>
    </AdminShell>
  );
}
