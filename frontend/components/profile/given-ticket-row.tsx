"use client";

import { useState } from "react";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { requestTransferRevert, type ApiGivenTicket } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api/http-error";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

const badgeBase = "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

/** Billet offert : trace en lecture seule, et demande d'annulation possible. */
export function GivenTicketRow({ given, onChanged }: { given: ApiGivenTicket; onChanged: () => void }) {
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = given.revert_request;
  const reverted = given.status === "REVERTED";
  const pending = request?.status === "PENDING";
  // Figé au premier rendu : une annulation n'est plus possible une fois l'événement commencé.
  const [eventPassed] = useState(() => new Date(given.event_start_at).getTime() <= Date.now());

  function askRevert() {
    setError(null);
    setDialog({
      title: "Demander l'annulation du transfert ?",
      message:
        "Notre équipe examinera votre demande. Si elle est acceptée, le billet vous sera rendu et le bénéficiaire le perdra. " +
        "Vous pouvez aussi appeler le support.",
      confirmLabel: "Envoyer la demande",
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Pourquoi souhaitez-vous annuler ce transfert ? (10 caractères minimum)",
      onConfirm: async (reason) => {
        try {
          await requestTransferRevert(given.id, reason ?? "");
          onChanged();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "La demande n'a pas pu être envoyée, veuillez réessayer.");
        }
      },
    });
  }

  return (
    <div className="border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hairline-1 text-lg">🎁</span>
          <div>
            <p className="text-sm font-bold text-ink-1">
              {given.event_name} — {given.ticket_category_name}
            </p>
            <p className="text-xs text-ink-5">
              {dateFormatter.format(new Date(given.event_start_at))} · billet {given.ticket_reference}
            </p>
            <p className="mt-0.5 text-xs text-ink-4">
              Offert à {given.to_holder_first_name} {given.to_holder_last_name} ({given.to_email}) le{" "}
              {dateTimeFormatter.format(new Date(given.at))}
            </p>
            {reverted && given.reverted_at ? (
              <p className="mt-0.5 text-xs font-medium text-success">
                Transfert annulé le {dateTimeFormatter.format(new Date(given.reverted_at))} : le billet vous a été rendu.
              </p>
            ) : request?.status === "REJECTED" ? (
              <p className="mt-0.5 text-xs text-ink-4">
                Demande d&apos;annulation refusée{request.decision_reason ? ` : ${request.decision_reason}` : "."}
              </p>
            ) : null}
          </div>
        </div>
        {reverted ? (
          <span className={`${badgeBase} bg-success/10 text-success ring-success/30`}>Rendu</span>
        ) : pending ? (
          <span className={`${badgeBase} bg-warning/10 text-warning ring-warning/30`}>Annulation demandée</span>
        ) : (
          <span className={`${badgeBase} bg-hairline-1 text-ink-4 ring-hairline-2`}>Offert</span>
        )}
      </div>

      {!reverted && !pending && !eventPassed ? (
        <button
          type="button"
          onClick={askRevert}
          className="ml-[3.25rem] mt-2 text-xs font-medium text-link hover:text-link-hover"
        >
          Demander l&apos;annulation de ce transfert
        </button>
      ) : null}
      {error ? <p className="ml-[3.25rem] mt-2 text-xs text-danger">{error}</p> : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
