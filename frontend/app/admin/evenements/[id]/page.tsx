"use client";

// Fiche complète d'un événement pour l'administration : actions (désactiver,
// masquer, annuler, demandes d'annulation), organisateur, ventes, finances,
// reversement, billets, informations, carte, description, documents,
// participants et historique des actions. Composant client : les routes
// /admin exigent le jeton de la session (localStorage).

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid } from "@/components/admin/document-viewer";
import { EventAdminControls } from "@/components/admin/event-admin-controls";
import { AttendeesExplorer } from "@/components/dashboard/attendees-explorer";
import { EventOrganizerOverview, eventTiming } from "@/components/dashboard/event-organizer-overview";
import { EventLocationMap } from "@/components/map/event-location-map";
import { getAdminEvent, getAdminEventOverview, type ApiAdminEvent, type ApiAdminEventOverview } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { auditActionLabels } from "@/lib/mappers/audit-mappers";
import { eventPath } from "@/lib/format/event-path";
import { dateTime as shortDateTime, fullDateTime as dateFormatter } from "@/lib/format/dates";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusBadge: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: "● Publié", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  PENDING_VALIDATION: { label: "⏳ En validation", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  DRAFT: { label: "Brouillon", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  ARCHIVED: { label: "Archivé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  CANCELLED: { label: "✕ Annulé", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  SUSPENDED: { label: "⊘ Désactivé", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
  POSTPONED: { label: "↻ Reporté", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  TERMINATED: { label: "Terminé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-ink-1">{title}</h2>
      {children}
    </section>
  );
}

function toCoordinate(value: string | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<ApiAdminEvent | null | undefined>(undefined);
  const [overview, setOverview] = useState<ApiAdminEventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    getAdminEvent(id)
      .then(setEvent)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setEvent(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger cet événement.");
        }
      });
    getAdminEventOverview(id)
      .then(setOverview)
      .catch(() => setOverview(null));
  }

  useEffect(load, [id]);

  if (event === undefined) {
    return (
      <AdminShell active="/admin/evenements">
        <MutedMessage>{error ?? "Chargement…"}</MutedMessage>
      </AdminShell>
    );
  }

  if (event === null) {
    return (
      <AdminShell active="/admin/evenements">
        <div className={cardClass("p-8 text-center")}>
          <h1 className="text-lg font-bold text-ink-1">Événement introuvable</h1>
        </div>
      </AdminShell>
    );
  }

  const badge = statusBadge[event.status] ?? statusBadge.DRAFT;
  const address = [event.venue_address_line1, event.venue_address_line2, `${event.venue_postal_code} ${event.venue_city}`, event.venue_country]
    .filter(Boolean)
    .join(", ");
  const exportName = `participants-${event.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;

  return (
    <AdminShell active="/admin/evenements">
      <BackLink href="/admin/evenements">Événements</BackLink>

      {error ? (
        <Alert className="mb-6">{error}</Alert>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-1">{event.title}</h1>
            <Badge tone={badge.className} size="md">{badge.label}</Badge>
            <span className="rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2">
              {eventTiming(event.start_date, event.end_date)}
            </span>
            {event.is_hidden ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                Masqué au public
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-5">
            {dateFormatter.format(new Date(event.start_date))} · {event.venue_name}, {event.venue_city} · {event.category_label}
          </p>
        </div>
        <Link
          href={eventPath(event)}
          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
        >
          Voir la page publique →
        </Link>
      </div>

      <EventAdminControls event={event} onChanged={load} />

      <Section title="Organisateur">
        <div className={cardClass("flex flex-wrap items-center justify-between gap-4 px-5 py-4")}>
          {overview?.organizer ? (
            <div className="text-sm">
              <p className="font-semibold text-ink-1">
                {overview.organizer.first_name} {overview.organizer.last_name}
                {overview.organizer.is_suspended ? (
                  <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
                    Compte suspendu
                  </span>
                ) : null}
              </p>
              <p className="text-ink-4">{overview.organizer.email}</p>
              {overview.organizer.phone ? <p className="text-ink-4">{overview.organizer.phone}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-ink-4">{event.organizer_name}</p>
          )}
          <Link
            href={`/admin/utilisateurs/${event.organizer_id}`}
            className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
          >
            Voir la fiche de l&apos;organisateur
          </Link>
        </div>
      </Section>

      {overview ? (
        <EventOrganizerOverview
          detail={{ event, fill_stats: overview.fill_stats, revenue: overview.revenue, tickets: overview.tickets }}
          ticketCategories={overview.ticket_categories}
          eventCategory={{
            id: event.category,
            code: event.category,
            label: event.category_label,
            emoji: event.category_emoji,
            display_order: 0,
            is_active: true,
          }}
          payout={overview.payout}
          viewer="ADMIN"
        />
      ) : (
        <p className={cardClass("mb-8 px-5 py-4 text-sm text-ink-5")}>Chargement des ventes et des finances…</p>
      )}

      <Section title="Lieu">
        <div className={cardClass("p-5")}>
          <p className="text-sm font-semibold text-ink-1">{event.venue_name}</p>
          <p className="mb-3 text-sm text-ink-4">{address}</p>
          <EventLocationMap
            latitude={toCoordinate(event.venue_latitude)}
            longitude={toCoordinate(event.venue_longitude)}
            label={event.venue_name}
          />
        </div>
      </Section>

      <Section title="Description">
        <div className={cardClass("p-5")}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-3">{event.description}</p>
        </div>
      </Section>

      <Section title="Documents">
        <div className={cardClass("p-5")}>
          <DocumentGrid
            documents={[
              { id: "poster", label: "Affiche de l'événement", url: event.poster_url ?? "" },
              ...(event.cover_url ? [{ id: "cover", label: "Image de couverture", url: event.cover_url }] : []),
              ...(event.non_profit_document_url
                ? [{ id: "non-profit", label: "Justificatif à but non lucratif", url: event.non_profit_document_url }]
                : []),
            ]}
          />
        </div>
      </Section>

      {overview && overview.validation_requests.length > 0 ? (
        <Section title="Demandes de complément">
          <div className="flex flex-col gap-3">
            {overview.validation_requests.map((request) => (
              <div key={request.id} className={cardClass("px-5 py-4 text-sm")}>
                <p className="text-xs text-ink-5">Demandé le {shortDateTime.format(new Date(request.created_at))}</p>
                <p className="mt-1 text-ink-1">{request.message}</p>
                {request.response ? (
                  <p className="mt-2 rounded-xl bg-hairline-1 px-3 py-2 text-ink-3">
                    <span className="font-semibold">Réponse de l&apos;organisateur</span>
                    {request.responded_at ? ` (${shortDateTime.format(new Date(request.responded_at))})` : ""} : {request.response}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-500">En attente de réponse de l&apos;organisateur.</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Participants">
        {overview ? (
          <AttendeesExplorer tickets={overview.attendees} exportName={exportName} />
        ) : (
          <p className={cardClass("px-5 py-4 text-sm text-ink-5")}>Chargement…</p>
        )}
      </Section>

      <Section title="Historique des actions">
        <div className={cardClass("overflow-hidden")}>
          {overview && overview.history.length > 0 ? (
            overview.history.map((log) => (
              <div key={log.id} className="border-b border-hairline-1 px-5 py-3 text-sm last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink-1">
                    {log.action === "CUSTOM" && log.reason ? log.reason : auditActionLabels[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-ink-5">{shortDateTime.format(new Date(log.created_at))}</span>
                </div>
                <p className="text-xs text-ink-5">Par {log.performed_by_email ?? log.performed_by}</p>
                {log.reason && log.action !== "CUSTOM" ? <p className="mt-1 text-ink-3">{log.reason}</p> : null}
              </div>
            ))
          ) : (
            <p className="px-5 py-6 text-center text-sm text-ink-5">
              {overview ? "Aucune action enregistrée sur cet événement." : "Chargement…"}
            </p>
          )}
        </div>
      </Section>
    </AdminShell>
  );
}
