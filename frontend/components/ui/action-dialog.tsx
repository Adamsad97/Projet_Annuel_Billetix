"use client";

// Remplace window.confirm()/window.prompt() — popup native du navigateur au
// style incohérent avec le thème sombre de l'appli (repéré par l'utilisateur
// sur la boîte de rejet d'un événement, mais utilisé aussi pour les
// confirmations d'approbation/annulation/suppression un peu partout).

import { useEffect, useState } from "react";

export interface ActionDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12101c] p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-white">{state.title}</h2>
        <p className="mt-2 text-sm text-gray-400">{state.message}</p>

        {state.showReason ? (
          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={state.reasonPlaceholder ?? "Motif…"}
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-white/30 hover:text-white"
          >
            {state.cancelLabel ?? "Annuler"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={state.reasonRequired && !reason.trim()}
            className={
              state.danger
                ? "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                : "rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            }
          >
            {state.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
