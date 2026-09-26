"use client";

// Bug corrigé : page 100% maquette (validationQueue factice) — câblée sur
// les vraies actions de modération déjà construites côté backend
// (valider/rejeter/vérifier le justificatif non lucratif/demander un
// complément d'info) mais jamais reliées au frontend.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid, type SubmittedDocument } from "@/components/admin/document-viewer";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEvent, getEventCategories, type ApiEvent, type ApiTicketCategory } from "@/lib/api/events";
import {
  approveEvent,
  getPendingEvents,
  rejectEvent,
  requestEventInfo,
  verifyNonProfit,
  type ApiPendingEvent,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { statusBadgeStyles } from "@/lib/mock/dashboard";
import { EventLocationMap } from "@/components/map/event-location-map";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
// Bug corrigé : l'en-tête affichait created_at (date de création du
// brouillon en base) à la place de start_date (date choisie par
// l'organisateur pour l'événement) — un admin validait donc "à l'aveugle"
// sur une date qui n'avait aucun rapport avec l'événement réel.
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

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
    // Pas d'endpoint "un seul événement en attente" — la liste complète
    // (organisateur/délai déjà résolus) reste la source la plus simple pour
    // une file de taille admin.
    getPendingEvents()
      .then((pending) => {
        const match = pending.find((item) => item.id === id);
        if (match) {
          setEvent(match);
          return;
        }
        // Plus dans la file (déjà traité, ou lien obsolète) — au moins
        // afficher les infos de base plutôt qu'une page cassée.
        return getEvent(id).then(setEvent);
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
      message: "Il sera publié immédiatement sur le catalogue.",
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

  async function handleVerifyNonProfit(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await verifyNonProfit(id, approved);
      setInfo(approved ? "Justificatif validé — exonération de commission appliquée." : "Justificatif rejeté.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de traiter le justificatif.");
    } finally {
      setBusy(false);
    }
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
        <p className="text-center text-sm text-ink-5">Cet événement n&apos;existe pas.</p>
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
        ...(event.non_profit_document_url
          ? [{ id: "justificatif", label: "Justificatif à but non lucratif", url: event.non_profit_document_url }]
          : []),
      ]
    : [];

  return (
    <AdminShell active="/admin/validation">
      <Link
        href="/admin/validation"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
      >
        ← Validation
      </Link>

      {event === undefined ? (
        <p className="text-center text-sm text-ink-5">Chargement…</p>
      ) : (
        <>
          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-300">
              {info}
            </div>
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
            <div className="mb-6 rounded-2xl border border-hairline-1 bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink-2">Vérification « à but non lucratif »</h2>
              <p className="mb-3 text-sm text-ink-4">
                {event.non_profit_verified
                  ? "✓ Justificatif déjà vérifié — commission à 0% appliquée."
                  : "Justificatif non encore vérifié — l'exonération de commission ne s'applique pas tant que ce n'est pas fait."}
              </p>
              {!event.non_profit_verified && event.non_profit_document_url ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerifyNonProfit(true)}
                    disabled={busy}
                    className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    ✓ Approuver le justificatif
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyNonProfit(false)}
                    disabled={busy}
                    className="rounded-lg bg-red-500/15 px-3.5 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                  >
                    ✕ Rejeter le justificatif
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Bug corrigé : page de validation ne montrait que titre, date
              (fausse, cf. plus haut) et ville — un admin devait approuver ou
              rejeter un événement public sans voir catégorie, capacité,
              adresse complète, tarifs, période de vente ni politique de
              remboursement, alors que toutes ces données étaient déjà
              chargées (ApiPendingEvent hérite d'ApiEvent en entier). */}
          <div className="mb-6 rounded-2xl border border-hairline-1 bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Informations de l&apos;événement</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-5">Catégorie</dt>
                <dd className="text-ink-2">{categoryByCode.get(event.category)?.label ?? event.category}</dd>
              </div>
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

          <div className="mb-6 rounded-2xl border border-hairline-1 bg-card p-5">
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
                      {tc.visibility === "PRIVATE" ? (
                        <span className="ml-2 rounded-full bg-hairline-2 px-2 py-0.5 text-[11px] text-ink-4">Privé</span>
                      ) : null}
                    </span>
                    <span className="text-ink-4">
                      {currency.format(Number(tc.price_ht))} HT · {tc.quota} places · max {tc.max_per_order}/commande
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-6 rounded-2xl border border-hairline-1 bg-card p-5">
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
            <div className="mt-6 rounded-2xl border border-hairline-1 bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink-2">Demander un complément d&apos;information</h2>
              <p className="mb-3 text-xs text-ink-5">
                Suspend le délai de traitement jusqu&apos;à la réponse de l&apos;organisateur.
              </p>
              <textarea
                rows={3}
                value={infoMessage}
                onChange={(evt) => setInfoMessage(evt.target.value)}
                placeholder="Ex : Précisez l'adresse exacte du lieu."
                className="w-full resize-none rounded-xl border border-hairline-2 bg-hairline-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
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
