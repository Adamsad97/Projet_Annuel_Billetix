import Link from "next/link";
import type { ApiAdminEvent } from "@/lib/api/admin";

// Bug corrigé : reposait sur lib/mock/admin-events.ts (emoji/couleur/libellé
// de statut figés) — la catégorie et le statut viennent désormais du vrai
// événement (event-service).
const statusBadge: Record<string, { label: string; className: string }> = {
  PUBLISHED: {
    label: "● Publié",
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  PENDING_VALIDATION: {
    label: "⏳ En validation",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  DRAFT: {
    label: "Brouillon",
    className: "bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10",
  },
  ARCHIVED: {
    label: "Archivé",
    className: "bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10",
  },
  CANCELLED: {
    label: "✕ Annulé",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  SUSPENDED: {
    label: "⊘ Suspendu",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  TERMINATED: {
    label: "Terminé",
    className: "bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10",
  },
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function AdminEventRow({ event }: { event: ApiAdminEvent }) {
  const badge = statusBadge[event.status] ?? statusBadge.DRAFT;
  const ticketsLabel =
    event.status === "DRAFT" || event.status === "PENDING_VALIDATION"
      ? "—"
      : `${new Intl.NumberFormat("fr-FR").format(event.sold)} / ${new Intl.NumberFormat("fr-FR").format(event.total_quota)}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">
          {event.category_emoji ?? "🎫"}
        </span>
        <div>
          <p className="text-sm font-bold text-white">{event.title}</p>
          <p className="text-xs text-gray-500">
            {event.organizer_name} · {event.category_label} · {dateFormatter.format(new Date(event.start_date))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-400">{ticketsLabel}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        <Link
          href={`/admin/evenements/${event.id}`}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          ● Détails
        </Link>
      </div>
    </div>
  );
}
