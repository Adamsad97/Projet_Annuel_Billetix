"use client";

// Pouvoirs de l'admin sur un événement : désactiver, masquer, annuler, traiter les demandes d'annulation.

import { useEffect, useState } from "react";
import { CancellationThread } from "@/components/events/cancellation-thread";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  cancelEventAsAdmin,
  featureEvent,
  hideEvent,
  suspendEvent,
  unfeatureEvent,
  unhideEvent,
  unsuspendEvent,
  type ApiAdminEvent,
} from "@/lib/api/admin";
import {
  adminReplyToCancellation,
  approveCancellation,
  listAdminEventCancellationRequests,
  rejectCancellation,
  type ApiCancellationRequest,
} from "@/lib/api/cancellation";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

const buttonClass =
  "rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50";
const dangerClass =
  "rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/5 disabled:opacity-50";
const positiveClass =
  "rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const CLOSED = ["CANCELLED", "TERMINATED", "ARCHIVED"];

export function EventAdminControls({ event, onChanged }: { event: ApiAdminEvent; onChanged: () => void }) {
  const [requests, setRequests] = useState<ApiCancellationRequest[]>([]);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadRequests() {
    listAdminEventCancellationRequests(event.id)
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(loadRequests, [event.id]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
      loadRequests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const isClosed = CLOSED.includes(event.status);
  const pending = requests.find((request) => request.status === "PENDING");

  function askSuspend() {
    setDialog({
      title: t("Désactiver l'événement"),
      message:
        t("Les ventes sont bloquées immédiatement. La page publique reste visible et affiche votre message. L'organisateur est prévenu par email."),
      confirmLabel: t("Désactiver"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Message affiché au public (ex. « Ventes suspendues le temps d'une vérification »)"),
      onConfirm: (reason) => run(() => suspendEvent(event.id, reason!), t("Impossible de désactiver l'événement.")),
    });
  }

  function askHide() {
    setDialog({
      title: t("Masquer l'événement au public"),
      message:
        t("L'événement disparaît de la liste des événements, sa page publique devient indisponible et les ventes sont bloquées. Les billets déjà vendus restent valables."),
      confirmLabel: t("Masquer"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Motif (visible par l'organisateur)"),
      onConfirm: (reason) => run(() => hideEvent(event.id, reason!), t("Impossible de masquer l'événement.")),
    });
  }

  function askCancel() {
    setDialog({
      title: t("Annuler définitivement l'événement"),
      message: t("Tous les billets sont annulés et les acheteurs remboursés automatiquement. Cette action est irréversible."),
      confirmLabel: t("Annuler l'événement"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Motif communiqué aux acheteurs"),
      onConfirm: (reason) => run(() => cancelEventAsAdmin(event.id, reason!), t("Impossible d'annuler l'événement.")),
    });
  }

  function askApprove(request: ApiCancellationRequest) {
    const postponement = request.kind === "POSTPONEMENT";
    setDialog({
      title: postponement ? t("Accepter la demande de report") : t("Accepter la demande d'annulation"),
      message: postponement
        ? request.new_start_date
          ? t("L'événement passe à la nouvelle date proposée. Les acheteurs sont prévenus par email : leur billet reste valable, et ils peuvent demander le remboursement pendant le délai prévu.")
          : t("L'événement passe « Reporté » : ventes et contrôle suspendus jusqu'à ce que l'organisateur fixe la nouvelle date. Les acheteurs sont prévenus et peuvent demander le remboursement.")
        : t("L'événement est annulé et les acheteurs remboursés automatiquement, avec le motif de l'organisateur. Cette action est irréversible."),
      confirmLabel: postponement ? t("Accepter le report") : t("Accepter et annuler"),
      danger: !postponement,
      showReason: true,
      reasonPlaceholder: t("Message à l'organisateur (facultatif)"),
      onConfirm: (message) => run(() => approveCancellation(request.id, message), t("Impossible d'accepter la demande.")),
    });
  }

  function askReject(request: ApiCancellationRequest) {
    setDialog({
      title: request.kind === "POSTPONEMENT" ? t("Refuser la demande de report") : t("Refuser la demande d'annulation"),
      message: t("L'événement continue normalement. Expliquez votre décision à l'organisateur : il pourra faire une nouvelle demande."),
      confirmLabel: t("Refuser"),
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Message à l'organisateur"),
      onConfirm: (message) => run(() => rejectCancellation(request.id, message!), t("Impossible de refuser la demande.")),
    });
  }

  async function reply(requestId: string, message: string) {
    try {
      const updated = await adminReplyToCancellation(requestId, message);
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Impossible d'envoyer le message."));
      throw err;
    }
  }

  return (
    <>
      {error ? (
        <Alert className="mb-6">{error}</Alert>
      ) : null}

      {event.status === "SUSPENDED" ? (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-ink-2">
          <p className="font-semibold text-ink-1">{t("Désactivé : les ventes sont bloquées")}</p>
          {event.suspension_reason ? <p className="mt-1">{t("Message public : « {suspension_reason} »", { suspension_reason: event.suspension_reason })}</p> : null}
        </div>
      ) : null}
      {event.featured_at ? (
        <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-ink-2">
          <p className="font-semibold text-ink-1">{t("★ À la une de l'accueil")}</p>
          <p className="mt-1">{t("Cet événement fait partie de la sélection « À la une » montrée aux visiteurs.")}</p>
        </div>
      ) : null}
      {event.is_hidden ? (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-ink-2">
          <p className="font-semibold text-ink-1">{t("Masqué au public")}</p>
          {event.hidden_reason ? <p className="mt-1">{t("Motif : « {hidden_reason} »", { hidden_reason: event.hidden_reason })}</p> : null}
        </div>
      ) : null}

      <section className={cardClass("mb-6 p-5")}>
        <h2 className="mb-1 text-sm font-semibold text-ink-2">{t("Gestion de l'événement")}</h2>
        <p className="mb-4 text-xs text-ink-5">
          {isClosed ? t("Cet événement est clos : aucune action n'est possible.") : t("Chaque action est enregistrée dans le journal d'audit.")}
        </p>
        {!isClosed ? (
          <div className="flex flex-wrap gap-2">
            {event.status === "PUBLISHED" ? (
              <button type="button" onClick={askSuspend} disabled={busy} className={dangerClass}>{t("Désactiver (message public)")}</button>
            ) : null}
            {event.status === "SUSPENDED" ? (
              <button
                type="button"
                onClick={() => run(() => unsuspendEvent(event.id), t("Impossible de réactiver l'événement."))}
                disabled={busy}
                className={positiveClass}
              >{t("Réactiver les ventes")}</button>
            ) : null}
            {event.featured_at ? (
              <button
                type="button"
                onClick={() => run(() => unfeatureEvent(event.id), t("Impossible de retirer l'événement de la une."))}
                disabled={busy}
                className={buttonClass}
              >{t("★ Retirer de la une")}</button>
            ) : (event.status === "PUBLISHED" || event.status === "SUSPENDED") && !event.is_hidden ? (
              <button
                type="button"
                onClick={() => run(() => featureEvent(event.id), t("Impossible de mettre l'événement à la une."))}
                disabled={busy}
                className={positiveClass}
              >{t("☆ Mettre à la une")}</button>
            ) : null}
            {event.is_hidden ? (
              <button
                type="button"
                onClick={() => run(() => unhideEvent(event.id), t("Impossible de rendre l'événement visible."))}
                disabled={busy}
                className={buttonClass}
              >{t("Rendre visible au public")}</button>
            ) : (
              <button type="button" onClick={askHide} disabled={busy} className={buttonClass}>{t("Masquer au public")}</button>
            )}
            <button type="button" onClick={askCancel} disabled={busy} className={dangerClass}>{t("Annuler l'événement")}</button>
          </div>
        ) : null}
      </section>

      {requests.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-ink-2">{t("Demandes d'annulation ou de report de l'organisateur")}</h2>
          <p className="mb-3 text-xs text-ink-5">
            {pending ? t("Une demande attend votre décision. Échangez avec l'organisateur jusqu'à trouver un accord.") : t("Historique des demandes.")}
          </p>
          <div className="flex flex-col gap-3">
            {requests.map((request) => (
              <CancellationThread
                key={request.id}
                request={request}
                viewer="ADMIN"
                onReply={(message) => reply(request.id, message)}
                actions={
                  <>
                    <button type="button" onClick={() => askReject(request)} disabled={busy} className={buttonClass}>{t("Refuser")}</button>
                    <button type="button" onClick={() => askApprove(request)} disabled={busy} className={dangerClass}>{t("Accepter et annuler")}</button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
