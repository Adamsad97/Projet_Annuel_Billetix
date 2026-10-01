"use client";

// Remplace window.confirm() et window.prompt() par une fenêtre au style du site.

import { useEffect, useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { t } from "@/lib/i18n/translate";

export interface ActionDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Récapitulatif affiché sous le message (ex. aperçu d'une newsletter). */
  details?: ReactNode;
  // Affiche un champ texte (motif). reasonRequired bloque la confirmation
  // tant qu'il est vide — sinon le motif reste facultatif (ex: annulation).
  showReason?: boolean;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
}

export function ActionDialog({
  state,
  onClose,
}: {
  state: ActionDialogState | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const titleId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialise le champ à chaque nouvelle ouverture de dialog
    setReason("");
  }, [state]);

  if (!state) return null;

  function handleConfirm() {
    if (!state) return;
    const trimmed = reason.trim();
    if (state.reasonRequired && !trimmed) return;
    state.onConfirm(state.showReason ? trimmed || undefined : undefined);
    onClose();
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} className="cursor-pointer bg-black/70 p-6">
      <div
        className="w-full max-w-md cursor-auto rounded-2xl border border-hairline-2 bg-card p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-ink-1">{t(state.title)}</h2>
        <p className="mt-2 text-sm text-ink-4">{state.message}</p>
        {state.details ? <div className="mt-4">{state.details}</div> : null}

        {state.showReason ? (
          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={state.reasonPlaceholder ?? t("Motif…")}
            className="mt-4 w-full resize-none rounded-xl border border-hairline-2 bg-hairline-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-5 hover:text-ink-1"
          >
            {state.cancelLabel ?? t("Annuler")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={state.reasonRequired && !reason.trim()}
            className={
              state.danger
                ? "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                : "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            }
          >
            {state.confirmLabel ?? t("Confirmer")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
