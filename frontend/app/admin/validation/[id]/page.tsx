"use client";

// Validation câblée sur les vraies actions de modération du backend.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid, type SubmittedDocument } from "@/components/admin/document-viewer";
import { EventVatRateControl } from "@/components/admin/event-vat-rate-control";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEventCategories, ticketVisibilityLabels, type ApiEvent, type ApiTicketCategory } from "@/lib/api/events";
import {
  approveEvent,
  getAdminEvent,
  getPendingEvents,
  rejectEvent,
  requestEventInfo,
  verifyNonProfit,
  type ApiPendingEvent,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { statusBadgeStyles } from "@/lib/constants/dashboard";
import { EventLocationMap } from "@/components/map/event-location-map";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateFormatter } from "@/lib/format/dates";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";

// L'en-tête affiche la date de l'événement (start_date), pas celle de création.
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminValidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [event, setEvent] = useState<ApiEvent | ApiPendingEvent | null | undefined>(undefined);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [ticketCategories, setTicketCategories] = useState<ApiTicketCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function load() {
    // Pas d'endpoint pour un seul événement en attente : on reprend la liste complète.
    getPendingEvents()
      .then((pending) => {
        const match = pending.find((item) => item.id === id);
        if (match) {
          setEvent(match);
          return;
        }
        // Plus dans la file (déjà traité, ou lien obsolète) : fiche admin de
        // l'événement, qui porte aussi le nom de l'organisateur.
        return getAdminEvent(id).then(setEvent);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setEvent(null);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Impossible de charger cet événement.");
      });
  }

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
    getEventCategories(id).then(setTicketCategories).catch(() => setTicketCategories([]));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleApprove() {
    setDialog({
      title: "Valider cet événement ?",
      message: "Il sera publié immédiatement et visible par tous.",
      confirmLabel: "✓ Valider",
      onConfirm: async () => {
        setBusy(true);
        setError(null);
        try {
          await approveEvent(id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de valider cet événement.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleReject() {
    setDialog({
      title: "Rejeter cet événement",
      message: "Le motif sera communiqué à l'organisateur.",
      confirmLabel: "✕ Rejeter",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du rejet…",
      onConfirm: async (reason) => {
        setBusy(true);
        setError(null);
        try {
          await rejectEvent(id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de rejeter cet événement.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function decideNonProfit(approved: boolean, reason?: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyNonProfit(id, approved, reason);
      setInfo(
        approved
          ? "Justificatif validé — exonération de commission appliquée."
          : "Justificatif refusé — l'organisateur a été informé du motif.",
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de traiter le justificatif.");
    } finally {
      setBusy(false);
    }
  }

  function handleRejectNonProfit() {
    setDialog({
      title: "Refuser le justificatif",
      message: "Le motif sera communiqué à l'organisateur, qui pourra envoyer un nouveau justificatif.",
      confirmLabel: "✕ Refuser",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du refus (document illisible, association non reconnue…)",
      onConfirm: (reason) => decideNonProfit(false, reason),
    });
  }

  async function handleRequestInfo() {
    if (!infoMessage.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestEventInfo(id, infoMessage.trim());
      setInfoMessage("");
      setInfo("Demande de complément envoyée à l'organisateur — le délai de traitement est suspendu.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer la demande.");
    } finally {
      setBusy(false);
    }
  }

  if (event === null) {
    return (
      <AdminShell active="/admin/validation">
        <MutedMessage>Cet événement n&apos;existe pas.</MutedMessage>
        <Link href="/admin/validation" className="mt-4 block text-center text-sm font-medium text-link hover:text-link-hover">
          ← Validation
        </Link>
      </AdminShell>
    );
  }

  const categoryByCode = new Map(categories.map((category) => [category.code, category]));
  const categoryEmoji = event ? (categoryByCode.get(event.category)?.emoji ?? "🎫") : "🎫";
  const isPending = event?.status === "PENDING_VALIDATION";
  const isOverdue = event && "is_overdue" in event ? event.is_overdue : false;
  const organizerName = event && "organizer_name" in event ? event.organizer_name : null;
  const organizerEmail = event && "organizer_email" in event ? event.organizer_email : null;

  const documents: SubmittedDocument[] = event
    ? [
        ...(event.poster_url ? [{ id: "poster", label: "Affiche de l'événement", url: event.poster_url }] : []),
        ...(event.cover_url ? [{ id: "cover", label: "Image de couverture", url: event.cover_url }] : []),
        ...(event.non_profit_document_url
          ? [{ id: "justificatif", label: "Justificatif à but non lucratif", url: event.non_profit_document_url }]
          : []),
      ]
    : [];

  return (
    <AdminShell active="/admin/validation">
      <BackLink href="/admin/validation">Validation</BackLink>

      {event === undefined ? (
        <MutedMessage />
      ) : (
        <>
          {error ? (
            <Alert className="mb-6">
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert tone="success" className="mb-6">
              {info}
            </Alert>
          ) : null}

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-hairline-1 text-2xl">
                {categoryEmoji}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-ink-1">{event.title}</h1>
                  {event.is_non_profit ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                      Non lucratif
                    </span>
                  ) : null}
                  {isOverdue ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
                      ⚠️ Délai dépassé
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-ink-5">
                  {organizerName ?? "Organisateur inconnu"}
                  {organizerEmail ? ` (${organizerEmail})` : ""} · {dateTimeFormatter.format(new Date(event.start_date))}
                  {" · "}
                  {event.venue_name}, {event.venue_city}
                </p>
                <p className="mt-0.5 text-xs text-ink-6">
                  Soumis le {dateFormatter.format(new Date(event.created_at))}
                  {event && "validation_deadline" in event && isPending
                    ? ` · à traiter avant le ${dateTimeFormatter.format(new Date(event.validation_deadline))}`
                    : ""}
                </p>
              </div>
            </div>

            {isPending ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={busy}
                  className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  ✓ Valider
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={busy}
                  className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  ✕ Rejeter
                </button>
              </div>
            ) : (
              <span className={`rounded-full px-4 py-2 text-sm font-medium ${statusBadgeStyles[event.status].className}`}>
                Statut : {statusBadgeStyles[event.status].label}
              </span>
            )}
          </div>

          {event.is_non_profit ? (
            <div className={cardClass("mb-6 p-5")}>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">Vérification « à but non lucratif »</h2>
              {event.non_profit_verified ? (
                <p className="mb-3 text-sm text-ink-4">✓ Justificatif vérifié — commission à 0 % appliquée.</p>
              ) : event.non_profit_rejected_at ? (
                <div className="mb-3 rounded-xl bg-red-500/5 px-4 py-3 text-sm ring-1 ring-inset ring-red-500/25">
                  <p className="font-medium text-ink-1">
                    ✕ Justificatif refusé le {new Date(event.non_profit_rejected_at).toLocaleDateString("fr-FR")}
                  </p>
                  {event.non_profit_rejection_reason ? (
                    <p className="mt-1 text-ink-3">Motif : {event.non_profit_rejection_reason}</p>
                  ) : null}
                  <p className="mt-1 text-ink-5">En attente d&apos;un nouveau justificatif de l&apos;organisateur.</p>
                </div>
              ) : (
                <p className="mb-3 text-sm text-ink-4">
                  Justificatif à examiner — l&apos;exonération de commission ne s&apos;applique qu&apos;une fois validé.
                </p>
              )}
              {!event.non_profit_verified && !event.non_profit_rejected_at && event.non_profit_document_url ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => decideNonProfit(true)}
                    disabled={busy}
                    className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    ✓ Approuver le justificatif
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectNonProfit}
                    disabled={busy}
                    className="rounded-lg bg-red-500/15 px-3.5 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                  >
                    ✕ Rejeter le justificatif
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Toutes les informations utiles à la validation (catégorie, capacité, adresse, tarifs, ventes, remboursement). */}
          <div className={cardClass("mb-6 p-5")}>
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Informations de l&apos;événement</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-5">Catégorie</dt>
                <dd className="text-ink-2">{categoryByCode.get(event.category)?.label ?? event.category}</dd>
              </div>
              <EventVatRateControl
                eventId={event.id}
                vatRate={event.vat_rate}
                vatRateLabel={event.vat_rate_label}
                editable={event.status === "PENDING_VALIDATION" || event.status === "DRAFT"}
                onChanged={() => {
                  load();
                  getEventCategories(id).then(setTicketCategories).catch(() => undefined);
                }}
              />
              <div>
                <dt className="text-ink-5">Capacité totale</dt>
                <dd className="text-ink-2">{event.total_capacity} places</dd>
              </div>
              <div>
                <dt className="text-ink-5">Début</dt>
                <dd className="text-ink-2">{dateTimeFormatter.format(new Date(event.start_date))}</dd>
              </div>
              <div>
                <dt className="text-ink-5">Fin</dt>
                <dd className="text-ink-2">{dateTimeFormatter.format(new Date(event.end_date))}</dd>
              </div>
              <div>
                <dt className="text-ink-5">Ventes ouvertes</dt>
                <dd className="text-ink-2">
                  {dateTimeFormatter.format(new Date(event.sales_start_date))} → {dateTimeFormatter.format(new Date(event.sales_end_date))}
                </dd>
              </div>
              <div>
                <dt className="text-ink-5">Politique de remboursement</dt>
                <dd className="text-ink-2">
                  {event.refund_policy === "REFUNDABLE"
                    ? `Remboursable${event.refund_deadline_days ? ` (jusqu'à J-${event.refund_deadline_days})` : ""}`
                    : "Non remboursable"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-5">Lieu</dt>
                <dd className="text-ink-2">
                  {event.venue_name} — {event.venue_address_line1}
                  {event.venue_address_line2 ? `, ${event.venue_address_line2}` : ""}, {event.venue_postal_code}{" "}
                  {event.venue_city}, {event.venue_country}
                </dd>
              </div>
              {event.access_conditions ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-5">Conditions d&apos;accès</dt>
                  <dd className="text-ink-2">{event.access_conditions}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4">
              <EventLocationMap
                latitude={event.venue_latitude !== null ? Number(event.venue_latitude) : null}
                longitude={event.venue_longitude !== null ? Number(event.venue_longitude) : null}
                label={event.venue_name}
              />
            </div>
          </div>

          <div className={cardClass("mb-6 p-5")}>
            <h2 className="mb-3 text-sm font-semibold text-ink-2">
              Catégories de billets {ticketCategories.length > 0 ? `(${ticketCategories.length})` : ""}
            </h2>
            {ticketCategories.length === 0 ? (
              <p className="text-sm text-ink-5">Aucune catégorie de billet créée.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ticketCategories.map((tc) => (
                  <li key={tc.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-2">
                      {tc.name}
                      {tc.visibility !== "PUBLIC" ? (
                        <span className="ml-2 rounded-full bg-hairline-2 px-2 py-0.5 text-[11px] text-ink-4">
                          {ticketVisibilityLabels[tc.visibility]}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-4">
                      {currency.format(Number(tc.price_ht))} HT · {currency.format(Number(tc.price_ttc))} TTC · {tc.quota} places · max {tc.max_per_order}/commande
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cardClass("mb-6 p-5")}>
            <h2 className="mb-2 text-sm font-semibold text-ink-2">Description</h2>
            <p className="text-sm text-ink-4">{event.description}</p>
          </div>

          {documents.length > 0 ? (
            <>
              <h2 className="mb-3 text-sm font-semibold text-ink-2">
                Documents soumis ({documents.length})
              </h2>
              <DocumentGrid documents={documents} />
            </>
          ) : null}

          {isPending ? (
            <div className={cardClass("mt-6 p-5")}>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">Demander un complément d&apos;information</h2>
              <p className="mb-3 text-xs text-ink-5">
                Suspend le délai de traitement jusqu&apos;à la réponse de l&apos;organisateur.
              </p>
              <textarea
                rows={3}
                value={infoMessage}
                onChange={(evt) => setInfoMessage(evt.target.value)}
                placeholder="Ex : Précisez l'adresse exacte du lieu."
                className={fieldClass("w-full resize-none px-3 py-2")}
              />
              <button
                type="button"
                onClick={handleRequestInfo}
                disabled={busy || !infoMessage.trim()}
                className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Envoyer la demande
              </button>
            </div>
          ) : null}
        </>
      )}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
