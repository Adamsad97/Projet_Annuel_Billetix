"use client";

// Gestion d'un événement câblée sur son dashboard, ses participants et les actions organisateur.

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
  listEventCancellationRequests,
  replyToCancellation,
  requestEventCancellation,
  requestEventPostponement,
  rescheduleEvent,
  withdrawCancellation,
  changeRequestKindLabels,
  type ApiCancellationRequest,
} from "@/lib/api/cancellation";
import { CancellationThread } from "@/components/events/cancellation-thread";
import { PostponeDialog, type PostponeDialogResult } from "@/components/events/postpone-dialog";
import {
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
import { eventPath } from "@/lib/format/event-path";
import { NonProfitResubmit } from "@/components/dashboard/non-profit-resubmit";
import { EventAgents } from "@/components/dashboard/event-agents";
import { fullDateTime as dateFormatter } from "@/lib/format/dates";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

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
  // Fenêtre « Assigner des agents » (ouverte depuis l'en-tête ou la section).
  const [agentsDialogOpen, setAgentsDialogOpen] = useState(false);
  const [cancellations, setCancellations] = useState<ApiCancellationRequest[]>([]);
  // Fenêtre de report : demande à l'admin, ou nouvelle date d'un événement reporté.
  const [postponeMode, setPostponeMode] = useState<"request" | "reschedule" | null>(null);
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
      listEventCancellationRequests(id).catch(() => []),
    ])
      .then(([dashboardResult, attendeesResult, requestsResult, ticketCategoriesResult, categoriesResult, payoutsResult, cancellationsResult]) => {
        setCancellations(cancellationsResult);
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
        setError(err instanceof ApiError ? err.message : t("Impossible de charger cet événement."));
      });
  }

  useEffect(load, [id]);

  function handleSubmit() {
    setDialog({
      title: t("Soumettre à la validation ?"),
      message: t("L'admin examinera votre événement avant publication (sous 48h ouvrées)."),
      confirmLabel: "Soumettre →",
      onConfirm: async () => {
        setActionBusy(true);
        setError(null);
        try {
          await submitEventForValidation(id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible de soumettre l'événement."));
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  // L'annulation n'est jamais immédiate : elle doit être acceptée par un
  // admin, après échange si besoin. L'événement continue en attendant.
  function handleRequestCancellation() {
    setDialog({
      title: t("Demander l'annulation de l'événement"),
      message:
        t("Votre demande sera examinée par l'administration. L'événement reste en vente en attendant. Si elle est acceptée, les acheteurs sont remboursés et reçoivent votre motif."),
      confirmLabel: t("Envoyer la demande"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Expliquez la raison de l'annulation…"),
      onConfirm: async (reason) => {
        setActionBusy(true);
        setError(null);
        try {
          await requestEventCancellation(id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible d'envoyer la demande d'annulation."));
        } finally {
          setActionBusy(false);
        }
      },
    });
  }

  async function handlePostpone(result: PostponeDialogResult) {
    if (result.mode === "request") {
      await requestEventPostponement(id, result.reason, result.dates);
    } else {
      await rescheduleEvent(id, result.dates.start, result.dates.end);
    }
    setPostponeMode(null);
    load();
  }

  function handleWithdraw(requestId: string) {
    setDialog({
      title: t("Retirer votre demande ?"),
      message: t("L'événement continue normalement. Vous pourrez faire une nouvelle demande plus tard."),
      confirmLabel: t("Retirer la demande"),
      onConfirm: async () => {
        try {
          await withdrawCancellation(requestId);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible de retirer la demande."));
        }
      },
    });
  }

  async function handleCancellationReply(requestId: string, message: string) {
    try {
      const updated = await replyToCancellation(requestId, message);
      setCancellations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Impossible d'envoyer le message."));
      throw err;
    }
  }

  async function handleDuplicate() {
    setActionBusy(true);
    setError(null);
    try {
      const clone = await duplicateEvent(id);
      // Duplication : redirige vers la modification pour changer d'abord les dates.
      router.push(`/evenements/${clone.id}/modifier`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Impossible de dupliquer l'événement."));
      setActionBusy(false);
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${eventPath({ id, slug: detail?.event.slug })}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("Impossible de copier le lien : copiez-le depuis la page publique."));
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
      setError(err instanceof ApiError ? err.message : t("Impossible d'envoyer la réponse."));
    } finally {
      setActionBusy(false);
    }
  }

  if (notFoundError) {
    return (
      <div className="flex flex-1 flex-col bg-page">
        <AuthHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-center">
          <p className="text-sm text-ink-5">{t("Cet événement n'existe pas ou n'appartient pas à votre compte.")}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-link hover:text-link-hover">{t("← Retour au dashboard")}</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <BackLink href="/dashboard">{t("Dashboard")}</BackLink>

        {error ? (
          <Alert className="mb-6">
            {error}
          </Alert>
        ) : null}

        {detail === undefined ? (
          <MutedMessage />
        ) : (
          <>
            {(() => {
              const { event, fill_stats } = detail;
              const badge = statusBadgeStyles[event.status];
              const pendingRequests = validationRequests.filter((request) => !request.responded_at);
              const pendingCancellation = cancellations.find((request) => request.status === "PENDING");
              // Demandes à afficher : celle en cours et la dernière décision.
              const shownCancellations = cancellations.slice(0, pendingCancellation ? 2 : 1);
              // Agents de contrôle : utiles dès la soumission et jusqu'à la fin du contrôle.
              const canManageAgents = ["PENDING_VALIDATION", "PUBLISHED", "SUSPENDED", "POSTPONED", "TERMINATED"].includes(
                event.status,
              );
              const canRequestCancellation =
                !pendingCancellation &&
                ["DRAFT", "PENDING_VALIDATION", "PUBLISHED", "SUSPENDED", "POSTPONED"].includes(event.status);
              // Report : événement publié (le serveur refuse s'il a déjà commencé).
              const canRequestPostponement = !pendingCancellation && event.status === "PUBLISHED";
              const requestTitle = changeRequestKindLabels[shownCancellations[0]?.kind ?? "CANCELLATION"].title;

              return (
                <>
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-ink-1">{event.title}</h1>
                        <Badge tone={badge.className} size="md">
                          {t(badge.label)}
                        </Badge>
                        {event.status !== "POSTPONED" ? (
                          <span className="rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2">
                            {eventTiming(event.start_date, event.end_date)}
                          </span>
                        ) : null}
                        {event.is_hidden ? (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">{t("Masqué au public")}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-ink-5">
                        {event.status === "POSTPONED" ? t("Initialement prévu le ") : ""}
                        {dateFormatter.format(new Date(event.start_date))} · {event.venue_name}, {event.venue_city}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManageAgents ? (
                        <button
                          type="button"
                          onClick={() => setAgentsDialogOpen(true)}
                          className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-opacity hover:opacity-90"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="9" cy="8" r="3.5" />
                            <path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6M19 8v6M16 11h6" />
                          </svg>{t("Assigner des agents")}</button>
                      ) : null}
                      {event.is_hidden ? (
                        <span
                          title={t("La page publique est indisponible tant que l'événement est masqué.")}
                          className="rounded-full border border-hairline-2 px-4 py-2 text-sm font-medium text-ink-5"
                        >{t("Page publique indisponible")}</span>
                      ) : (
                        <Link
                          href={eventPath({ id, slug: detail?.event.slug })}
                          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
                        >{t("Voir la page publique →")}</Link>
                      )}
                      {event.status === "PUBLISHED" && !event.is_hidden ? (
                        <button
                          type="button"
                          onClick={copyPublicLink}
                          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
                        >
                          {copied ? t("Lien copié ✓") : t("Copier le lien")}
                        </button>
                      ) : null}
                      {event.status === "POSTPONED" ? (
                        <button
                          type="button"
                          onClick={() => setPostponeMode("reschedule")}
                          className={buttonClass("primary", "rounded-full px-4 py-2 text-sm")}
                        >{t("Fixer la nouvelle date")}</button>
                      ) : null}
                      {event.status !== "SUSPENDED" &&
                      event.status !== "POSTPONED" &&
                      event.status !== "CANCELLED" &&
                      event.status !== "TERMINATED" &&
                      event.status !== "ARCHIVED" ? (
                        <Link
                          href={`/evenements/${id}/modifier`}
                          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
                        >{t("✎ Modifier")}</Link>
                      ) : null}
                      {/* Duplication proposée seulement une fois l'événement complet. */}
                      {fill_stats.total_quota > 0 && fill_stats.remaining === 0 ? (
                        <button
                          type="button"
                          onClick={handleDuplicate}
                          disabled={actionBusy}
                          title={t("Programmer une nouvelle date pour ce même événement, maintenant complet")}
                          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
                        >{t("⎘ Programmer une nouvelle date")}</button>
                      ) : null}
                      {event.status === "DRAFT" ? (
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={actionBusy}
                          className={buttonClass("primary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
                        >{t("Soumettre à la validation →")}</button>
                      ) : null}
                      {canRequestPostponement ? (
                        <button
                          type="button"
                          onClick={() => setPostponeMode("request")}
                          disabled={actionBusy}
                          className="rounded-full border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/5 disabled:opacity-50"
                        >{t("Demander un report")}</button>
                      ) : null}
                      {canRequestCancellation ? (
                        <button
                          type="button"
                          onClick={handleRequestCancellation}
                          disabled={actionBusy}
                          className="rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/5 disabled:opacity-50"
                        >{t("Demander l'annulation")}</button>
                      ) : null}
                    </div>
                  </div>

                  {canManageAgents ? (
                    <EventAgents
                      eventId={event.id}
                      eventTitle={event.title}
                      inviteOpen={agentsDialogOpen}
                      onInviteOpenChange={setAgentsDialogOpen}
                    />
                  ) : null}

                  {event.status === "DRAFT" && event.rejection_reason ? (
                    <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-200">
                      <p className="font-semibold">{t("Rejeté par l'admin")}</p>
                      <p className="mt-1 text-amber-200/80">{event.rejection_reason}</p>
                      <p className="mt-1 text-xs text-amber-200/60">{t("Corrigez votre demande puis soumettez-la à nouveau.")}</p>
                    </div>
                  ) : null}

                  {event.status === "SUSPENDED" ? (
                    <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-ink-2">
                      <p className="font-semibold text-ink-1">{t("Événement désactivé par l'administration : les ventes sont suspendues")}</p>
                      {event.suspension_reason ? <p className="mt-1">« {event.suspension_reason} »</p> : null}
                      <p className="mt-1 text-xs text-ink-4">{t("Ce message est affiché sur la page publique de l'événement.")}</p>
                    </div>
                  ) : null}

                  {event.status === "POSTPONED" ? (
                    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-ink-2">
                      <p className="font-semibold text-ink-1">{t("Événement reporté : nouvelle date à venir")}</p>
                      {event.postponement_reason ? <p className="mt-1">« {event.postponement_reason} »</p> : null}
                      <p className="mt-1 text-xs text-ink-4">{t("Les ventes et le contrôle des billets sont suspendus. Dès que vous connaissez la nouvelle date, indiquez-la avec « Fixer la nouvelle date » : les acheteurs seront prévenus par email.")}</p>
                    </div>
                  ) : event.postponed_at && event.original_start_date ? (
                    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm text-ink-2">
                      <p className="font-semibold text-ink-1">{t("Événement reporté")}</p>
                      <p className="mt-1">{t("Initialement prévu le {value}{value2}", { value: dateFormatter.format(new Date(event.original_start_date)), value2: event.postponement_reason ? ` · « ${event.postponement_reason} »` : "" })}</p>
                    </div>
                  ) : null}

                  {event.is_hidden ? (
                    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-ink-2">
                      <p className="font-semibold text-ink-1">{t("Événement masqué au public par l'administration")}</p>
                      {event.hidden_reason ? <p className="mt-1">« {event.hidden_reason} »</p> : null}
                      <p className="mt-1 text-xs text-ink-4">{t("Il n'apparaît plus dans la liste des événements, sa page publique est indisponible et les ventes sont bloquées. Les billets déjà vendus restent valables.")}</p>
                    </div>
                  ) : null}

                  {shownCancellations.length > 0 ? (
                    <section className="mb-8">
                      <h2 className="mb-1 text-lg font-bold text-ink-1">{requestTitle}</h2>
                      <p className="mb-3 text-sm text-ink-5">
                        {pendingCancellation
                          ? t("En cours d'examen par l'administration. Vous pouvez échanger ici jusqu'à trouver un accord.")
                          : t("Historique de votre dernière demande.")}
                      </p>
                      <div className="flex flex-col gap-3">
                        {shownCancellations.map((request) => (
                          <CancellationThread
                            key={request.id}
                            request={request}
                            viewer="ORGANIZER"
                            onReply={(message) => handleCancellationReply(request.id, message)}
                            actions={
                              <button
                                type="button"
                                onClick={() => handleWithdraw(request.id)}
                                className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
                              >{t("Retirer ma demande")}</button>
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {event.status === "CANCELLED" && event.cancellation_reason ? (
                    <div className="mb-6 rounded-2xl border border-hairline-2 bg-hairline-1 px-5 py-4 text-sm text-ink-3">
                      <p className="font-semibold">{t("Événement annulé")}</p>
                      <p className="mt-1 text-ink-4">{event.cancellation_reason}</p>
                    </div>
                  ) : null}

                  {pendingRequests.length > 0 ? (
                    <div className="mb-6 flex flex-col gap-3">
                      {pendingRequests.map((request) => (
                        <div key={request.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                          <p className="text-sm font-semibold text-amber-200">{t("💬 L'admin demande un complément d'information")}</p>
                          <p className="mt-1 text-sm text-amber-200/80">{request.message}</p>
                          <textarea
                            rows={2}
                            value={responseDrafts[request.id] ?? ""}
                            onChange={(evt) =>
                              setResponseDrafts((prev) => ({ ...prev, [request.id]: evt.target.value }))
                            }
                            placeholder={t("Votre réponse…")}
                            className={fieldClass("mt-3 w-full resize-none px-3 py-2")}
                          />
                          <button
                            type="button"
                            onClick={() => handleRespond(request.id)}
                            disabled={actionBusy || !responseDrafts[request.id]?.trim()}
                            className="mt-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >{t("Envoyer la réponse")}</button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {event.is_non_profit && event.non_profit_rejected_at ? (
                    <NonProfitResubmit event={event} onSubmitted={load} />
                  ) : null}

                  <EventOrganizerOverview
                    detail={detail}
                    ticketCategories={ticketCategories}
                    eventCategory={eventCategories.find((category) => category.code === event.category)}
                    payout={payout}
                  />

                  <h2 className="mb-4 text-lg font-bold text-ink-1">{t("Participants")}</h2>
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

      {detail ? (
        <PostponeDialog
          key={postponeMode ?? "closed"}
          mode={postponeMode ?? "request"}
          open={postponeMode !== null}
          eventTitle={detail.event.title}
          currentStart={detail.event.start_date}
          onClose={() => setPostponeMode(null)}
          onSubmit={handlePostpone}
        />
      ) : null}
      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
