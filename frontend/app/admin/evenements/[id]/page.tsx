"use client";

// Bug corrigé : page 100% maquette (adminEvents factices) — câblée sur
// GET /admin/events/:id. Convertie en composant client (comme les autres
// fiches détail admin) : cette route exige un token ADMIN, disponible
// uniquement côté navigateur (localStorage), jamais dans un Server
// Component qui tournerait dans le conteneur.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid } from "@/components/admin/document-viewer";
import { getAdminEvent, type ApiAdminEvent } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const statusBadge: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: "● Publié", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  PENDING_VALIDATION: { label: "⏳ En validation", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  DRAFT: { label: "Brouillon", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  ARCHIVED: { label: "Archivé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  CANCELLED: { label: "✕ Annulé", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  SUSPENDED: { label: "⊘ Suspendu", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  TERMINATED: { label: "Terminé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<ApiAdminEvent | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminEvent(id)
      .then(setEvent)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setEvent(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger cet événement.");
        }
      });
  }, [id]);

  if (event === undefined) {
    return (
      <AdminShell active="/admin/evenements">
        <p className="text-center text-sm text-ink-5">Chargement…</p>
      </AdminShell>
    );
  }

  if (event === null) {
    return (
      <AdminShell active="/admin/evenements">
        <div className="rounded-2xl border border-hairline-1 bg-card p-8 text-center">
          <div className="mb-3 text-4xl">🎫</div>
          <h1 className="text-lg font-bold text-ink-1">Événement introuvable</h1>
        </div>
      </AdminShell>
    );
  }

  const badge = statusBadge[event.status] ?? statusBadge.DRAFT;
  const ticketsLabel =
    event.status === "DRAFT" || event.status === "PENDING_VALIDATION"
      ? "—"
      : `${new Intl.NumberFormat("fr-FR").format(event.sold)} / ${new Intl.NumberFormat("fr-FR").format(event.total_quota)}`;

  return (
    <AdminShell active="/admin/evenements">
      <Link
        href="/admin/evenements"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
      >
        ← Événements
      </Link>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-hairline-1 text-2xl">
            {event.category_emoji ?? "🎫"}
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink-1">{event.title}</h1>
            <p className="text-sm text-ink-5">
              {event.organizer_name} · {event.category_label} · {dateFormatter.format(new Date(event.start_date))}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
              <span className="text-sm text-ink-4">{ticketsLabel} billets</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/evenements/${event.id}`}
            className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
          >
            Voir la page publique →
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-hairline-1 bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">Documents</h2>
        <DocumentGrid
          documents={[
            { id: "poster", label: "Affiche de l'événement", url: event.poster_url ?? "" },
            ...(event.non_profit_document_url
              ? [{ id: "non-profit", label: "Justificatif à but non lucratif", url: event.non_profit_document_url }]
              : []),
          ]}
        />
      </div>

      <div className="rounded-2xl border border-hairline-1 bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">Lieu</h2>
        <p className="text-sm text-ink-3">
          {event.venue_name} — {event.venue_address_line1}, {event.venue_postal_code} {event.venue_city}, {event.venue_country}
        </p>
      </div>
    </AdminShell>
  );
}
