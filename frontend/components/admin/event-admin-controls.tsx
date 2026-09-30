"use client";

// Pouvoirs de l'admin sur un événement : désactiver (message affiché au
// public, ventes bloquées), masquer au public, annuler (remboursements), et
// traiter les demandes d'annulation de l'organisateur.

import { useEffect, useState } from "react";
import { CancellationThread } from "@/components/events/cancellation-thread";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  cancelEventAsAdmin,
  hideEvent,
  suspendEvent,
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
      title: "Désactiver l'événement",
      message:
        "Les ventes sont bloquées immédiatement. La page publique reste visible et affiche votre message. L'organisateur est prévenu par email.",
      confirmLabel: "Désactiver",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Message affiché au public (ex. « Ventes suspendues le temps d'une vérification »)",
      onConfirm: (reason) => run(() => suspendEvent(event.id, reason!), "Impossible de désactiver l'événement."),
    });
  }

  function askHide() {
    setDialog({
      title: "Masquer l'événement au public",
      message:
        "L'événement disparaît du catalogue, sa page publique devient indisponible et les ventes sont bloquées. Les billets déjà vendus restent valables.",
      confirmLabel: "Masquer",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif (visible par l'organisateur)",
      onConfirm: (reason) => run(() => hideEvent(event.id, reason!), "Impossible de masquer l'événement."),
    });
  }

  function askCancel() {
    setDialog({
      title: "Annuler définitivement l'événement",
      message: "Tous les billets sont annulés et les acheteurs remboursés automatiquement. Cette action est irréversible.",
      confirmLabel: "Annuler l'événement",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif communiqué aux acheteurs",
      onConfirm: (reason) => run(() => cancelEventAsAdmin(event.id, reason!), "Impossible d'annuler l'événement."),
    });
  }

  function askApprove(request: ApiCancellationRequest) {
    const postponement = request.kind === "POSTPONEMENT";
    setDialog({
      title: postponement ? "Accepter la demande de report" : "Accepter la demande d'annulation",
      message: postponement
        ? request.new_start_date
          ? "L'événement passe à la nouvelle date proposée. Les acheteurs sont prévenus par email : leur billet reste valable, et ils peuvent demander le remboursement pendant le délai prévu."
          : "L'événement passe « Reporté » : ventes et contrôle suspendus jusqu'à ce que l'organisateur fixe la nouvelle date. Les acheteurs sont prévenus et peuvent demander le remboursement."
        : "L'événement est annulé et les acheteurs remboursés automatiquement, avec le motif de l'organisateur. Cette action est irréversible.",
      confirmLabel: postponement ? "Accepter le report" : "Accepter et annuler",
      danger: !postponement,
      showReason: true,
      reasonPlaceholder: "Message à l'organisateur (facultatif)",
      onConfirm: (message) => run(() => approveCancellation(request.id, message), "Impossible d'accepter la demande."),
    });
  }

  function askReject(request: ApiCancellationRequest) {
    setDialog({
      title: request.kind === "POSTPONEMENT" ? "Refuser la demande de report" : "Refuser la demande d'annulation",
      message: "L'événement continue normalement. Expliquez votre décision à l'organisateur : il pourra faire une nouvelle demande.",
      confirmLabel: "Refuser",
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Message à l'organisateur",
      onConfirm: (message) => run(() => rejectCancellation(request.id, message!), "Impossible de refuser la demande."),
    });
  }

  async function reply(requestId: string, message: string) {
    try {
      const updated = await adminReplyToCancellation(requestId, message);
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le message.");
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
          <p className="font-semibold text-ink-1">Désactivé : les ventes sont bloquées</p>
          {event.suspension_reason ? <p className="mt-1">Message public : « {event.suspension_reason} »</p> : null}
        </div>
      ) : null}
      {event.is_hidden ? (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-ink-2">
          <p className="font-semibold text-ink-1">Masqué au public</p>
          {event.hidden_reason ? <p className="mt-1">Motif : « {event.hidden_reason} »</p> : null}
        </div>
      ) : null}

      <section className={cardClass("mb-6 p-5")}>
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Gestion de l&apos;événement</h2>
        <p className="mb-4 text-xs text-ink-5">
          {isClosed ? "Cet événement est clos : aucune action n'est possible." : "Chaque action est enregistrée dans le journal d'audit."}
        </p>
        {!isClosed ? (
          <div className="flex flex-wrap gap-2">
            {event.status === "PUBLISHED" ? (
              <button type="button" onClick={askSuspend} disabled={busy} className={dangerClass}>
                Désactiver (message public)
              </button>
            ) : null}
            {event.status === "SUSPENDED" ? (
              <button
                type="button"
                onClick={() => run(() => unsuspendEvent(event.id), "Impossible de réactiver l'événement.")}
                disabled={busy}
                className={positiveClass}
              >
                Réactiver les ventes
              </button>
            ) : null}
            {event.is_hidden ? (
              <button
                type="button"
                onClick={() => run(() => unhideEvent(event.id), "Impossible de rendre l'événement visible.")}
                disabled={busy}
                className={buttonClass}
              >
                Rendre visible au public
              </button>
            ) : (
              <button type="button" onClick={askHide} disabled={busy} className={buttonClass}>
                Masquer au public
              </button>
            )}
            <button type="button" onClick={askCancel} disabled={busy} className={dangerClass}>
              Annuler l&apos;événement
            </button>
          </div>
        ) : null}
      </section>

      {requests.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-ink-2">Demandes d&apos;annulation ou de report de l&apos;organisateur</h2>
          <p className="mb-3 text-xs text-ink-5">
            {pending ? "Une demande attend votre décision. Échangez avec l'organisateur jusqu'à trouver un accord." : "Historique des demandes."}
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
                    <button type="button" onClick={() => askReject(request)} disabled={busy} className={buttonClass}>
                      Refuser
                    </button>
                    <button type="button" onClick={() => askApprove(request)} disabled={busy} className={dangerClass}>
                      Accepter et annuler
                    </button>
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
