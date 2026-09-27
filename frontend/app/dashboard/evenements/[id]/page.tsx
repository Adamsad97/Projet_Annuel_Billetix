"use client";

// Bug corrigé : page 100% maquette (eventDetails/attendeesByEvent factices)
// — câblée sur GET /events/:id/dashboard et GET /events/:id/attendees
// (api-gateway), plus les actions réelles (soumettre/annuler/dupliquer/
// répondre à une demande de complément) déjà construites côté backend mais
// jamais appelées par le frontend jusqu'ici.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { EventOrganizerOverview, eventTiming } from "@/components/dashboard/event-organizer-overview";
import { AttendeesExplorer } from "@/components/dashboard/attendees-explorer";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { statusBadgeStyles } from "@/lib/constants/dashboard";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { getMyPayouts, type ApiPayout } from "@/lib/api/organizer";
import {
  cancelEvent,
  duplicateEvent,
  getEventAttendees,
  getEventCategories,
  getEventDashboardDetail,
  getValidationRequests,
  respondToValidationRequest,
  submitEventForValidation,
  type ApiEventDashboardDetail,
  type ApiTicketCategory,
  type ApiValidationRequest,
} from "@/lib/api/events";
import type { ApiTicket } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api/http-error";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function DashboardEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<ApiEventDashboardDetail | undefined>(undefined);
  const [attendees, setAttendees] = useState<ApiTicket[]>([]);
  const [validationRequests, setValidationRequests] = useState<ApiValidationRequest[]>([]);
  const [ticketCategories, setTicketCategories] = useState<ApiTicketCategory[]>([]);
  const [eventCategories, setEventCategories] = useState<ApiCategory[]>([]);
  const [payout, setPayout] = useState<ApiPayout | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function load() {
    Promise.all([
      getEventDashboardDetail(id),
      getEventAttendees(id).catch(() => []),
      getValidationRequests(id).catch(() => []),
      getEventCategories(id).catch(() => []),
      listCategories().catch(() => []),
      getMyPayouts().catch(() => []),
    ])
      .then(([dashboardResult, attendeesResult, requestsResult, ticketCategoriesResult, categoriesResult, payoutsResult]) => {
        setDetail(dashboardResult);
        setAttendees(attendeesResult);
        setValidationRequests(requestsResult);
        setTicketCategories(ticketCategoriesResult);
        setEventCategories(categoriesResult);
        setPayout(payoutsResult.find((item) => item.event_id === id));
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setNotFoundError(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Impossible de charger cet événement.");
      });
  }

  useEffect(load, [id]);

  function handleSubmit() {
    setDialog({
      title: "Soumettre à la validation ?",
      message: "L'admin examinera votre événement avant publication (sous 48h ouvrées).",
      confirmLabel: "Soumettre →",
      onConfirm: async () => {
        setActionBusy(true);
        setError(null);
        try {
          await submitEventForValidation(id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de soumettre l'événement.");
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  function handleCancel() {
    setDialog({
      title: "Annuler cet événement",
      message: "Les acheteurs déjà payés seront automatiquement remboursés. Le motif leur sera communiqué.",
      confirmLabel: "Annuler l'événement",
      danger: true,
      showReason: true,
      reasonPlaceholder: "Motif d'annulation (optionnel)…",
      onConfirm: async (reason) => {
        setActionBusy(true);
        setError(null);
        try {
          await cancelEvent(id, reason);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible d'annuler l'événement.");
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  async function handleDuplicate() {
    setActionBusy(true);
    setError(null);
    try {
      const clone = await duplicateEvent(id);
      // Redirige directement vers la modification (pas la fiche) : le clone
      // reprend les dates de l'original telles quelles, la première chose à
      // faire est justement de les changer (ex : même artiste, autre date).
      router.push(`/evenements/${clone.id}/modifier`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de dupliquer l'événement.");
      setActionBusy(false);
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/evenements/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier le lien : copiez-le depuis la page publique.");
    }
  }

  async function handleRespond(requestId: string) {
    const response = responseDrafts[requestId]?.trim();
    if (!response) return;
    setActionBusy(true);
    setError(null);
    try {
      await respondToValidationRequest(requestId, response);
      setResponseDrafts((prev) => ({ ...prev, [requestId]: "" }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer la réponse.");
    } finally {
      setActionBusy(false);
    }
  }

  if (notFoundError) {
    return (
      <div className="flex flex-1 flex-col bg-page">
        <AuthHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-center">
          <p className="text-sm text-ink-5">
            Cet événement n&apos;existe pas ou n&apos;appartient pas à votre compte.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-link hover:text-link-hover">
            ← Retour au dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Dashboard
        </Link>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {detail === undefined ? (
          <p className="text-center text-sm text-ink-5">Chargement…</p>
        ) : (
          <>
            {(() => {
              const { event, fill_stats } = detail;
              const badge = statusBadgeStyles[event.status];
              const pendingRequests = validationRequests.filter((request) => !request.responded_at);

              return (
                <>
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-ink-1">{event.title}</h1>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2">
                          {eventTiming(event.start_date, event.end_date)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-5">
                        {dateFormatter.format(new Date(event.start_date))} · {event.venue_name}, {event.venue_city}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/evenements/${id}`}
                        className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
                      >
                        Voir la page publique →
                      </Link>
                      {event.status === "PUBLISHED" ? (
                        <button
                          type="button"
                          onClick={copyPublicLink}
                          className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
                        >
                          {copied ? "Lien copié ✓" : "Copier le lien"}
                        </button>
                      ) : null}
                      {event.status !== "SUSPENDED" &&
                      event.status !== "CANCELLED" &&
                      event.status !== "TERMINATED" &&
                      event.status !== "ARCHIVED" ? (
                        <Link
                          href={`/evenements/${id}/modifier`}
                          className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
                        >
                          ✎ Modifier
                        </Link>
                      ) : null}
                      {/* Bug corrigé (règle produit) : dupliquer n'a de sens
                          qu'une fois complet — sinon deux événements se
                          disputent le même stock. Cas réel : un artiste qui
                          rejoue le même jour, au même endroit, une fois les
                          places épuisées. */}
                      {fill_stats.total_quota > 0 && fill_stats.remaining === 0 ? (
                        <button
                          type="button"
                          onClick={handleDuplicate}
                          disabled={actionBusy}
                          title="Programmer une nouvelle date pour ce même événement, maintenant complet"
                          className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
                        >
                          ⎘ Programmer une nouvelle date
                        </button>
                      ) : null}
                      {event.status === "DRAFT" ? (
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={actionBusy}
                          className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Soumettre à la validation →
                        </button>
                      ) : null}
                      {event.status === "PUBLISHED" || event.status === "PENDING_VALIDATION" ? (
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={actionBusy}
                          className="rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/5 disabled:opacity-50"
                        >
                          Annuler l&apos;événement
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {event.status === "DRAFT" && event.rejection_reason ? (
                    <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-200">
                      <p className="font-semibold">Rejeté par l&apos;admin</p>
                      <p className="mt-1 text-amber-200/80">{event.rejection_reason}</p>
                      <p className="mt-1 text-xs text-amber-200/60">
                        Corrigez votre demande puis soumettez-la à nouveau.
                      </p>
                    </div>
                  ) : null}

                  {event.status === "SUSPENDED" && event.suspension_reason ? (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
                      <p className="font-semibold">Événement suspendu par l&apos;admin</p>
                      <p className="mt-1 text-red-300/80">{event.suspension_reason}</p>
                    </div>
                  ) : null}

                  {event.status === "CANCELLED" && event.cancellation_reason ? (
                    <div className="mb-6 rounded-2xl border border-hairline-2 bg-hairline-1 px-5 py-4 text-sm text-ink-3">
                      <p className="font-semibold">Événement annulé</p>
                      <p className="mt-1 text-ink-4">{event.cancellation_reason}</p>
                    </div>
                  ) : null}

                  {pendingRequests.length > 0 ? (
                    <div className="mb-6 flex flex-col gap-3">
                      {pendingRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                          <p className="text-sm font-semibold text-amber-200">
                            💬 L&apos;admin demande un complément d&apos;information
                          </p>
                          <p className="mt-1 text-sm text-amber-200/80">{request.message}</p>
                          <textarea
                            rows={2}
                            value={responseDrafts[request.id] ?? ""}
                            onChange={(evt) =>
                              setResponseDrafts((prev) => ({ ...prev, [request.id]: evt.target.value }))
                            }
                            placeholder="Votre réponse…"
                            className="mt-3 w-full resize-none rounded-xl border border-hairline-2 bg-hairline-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRespond(request.id)}
                            disabled={actionBusy || !responseDrafts[request.id]?.trim()}
                            className="mt-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            Envoyer la réponse
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <EventOrganizerOverview
                    detail={detail}
                    ticketCategories={ticketCategories}
                    eventCategory={eventCategories.find((category) => category.code === event.category)}
                    payout={payout}
                  />

                  <h2 className="mb-4 text-lg font-bold text-ink-1">Participants</h2>
                  <AttendeesExplorer
                    tickets={attendees}
                    exportName={`participants-${event.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`}
                  />
                </>
              );
            })()}
          </>
        )}
      </main>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
