"use client";

// Événement reporté : garder son billet ou demander le remboursement dans le délai.

import { useEffect, useState } from "react";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { Alert } from "@/components/ui/alert";
import { cardClass } from "@/components/ui/card";
import { getPostponementRefundStatus, requestPostponementRefund, type PostponementRefundStatus } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { longDate } from "@/lib/format/dates";

export function PostponementRefund({ orderId, onRefunded }: { orderId: string; onRefunded: () => void }) {
  const [status, setStatus] = useState<PostponementRefundStatus | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPostponementRefundStatus(orderId)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [orderId]);

  // Rien à proposer si l'événement n'a pas été reporté.
  if (!status?.postponed) return null;

  function askRefund() {
    setDialog({
      title: "Demander le remboursement ?",
      message:
        "Vos billets de cette commande seront annulés et ne permettront plus d'entrer. Le montant payé vous est remboursé. Cette action est définitive.",
      confirmLabel: "Me faire rembourser",
      danger: true,
      onConfirm: async () => {
        setError(null);
        try {
          await requestPostponementRefund(orderId);
          // Message de confirmation affiché par la page de la commande.
          onRefunded();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Le remboursement a échoué, veuillez réessayer.");
        }
      },
    });
  }

  return (
    <section aria-label="Événement reporté" className={cardClass("mb-6 border-amber-500/40 p-5")}>
      <p className="text-sm font-bold text-ink-1">Cet événement est reporté</p>
      <p className="mt-1 text-sm text-ink-3">Vos billets restent valables pour la nouvelle date : vous n&apos;avez rien à faire.</p>
      {status.available ? (
        <>
          <p className="mt-2 text-sm text-ink-3">
            Si la nouvelle date ne vous convient pas, vous pouvez demander le remboursement de cette commande
            {status.deadline ? ` jusqu'au ${longDate.format(new Date(status.deadline))}` : " tant que la nouvelle date n'est pas fixée"}.
          </p>
          {error ? <Alert className="mt-3">{error}</Alert> : null}
          <button
            type="button"
            onClick={askRefund}
            className="mt-4 rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/5"
          >
            Demander le remboursement
          </button>
        </>
      ) : status.message ? (
        <p className="mt-2 text-xs text-ink-5">{status.message}</p>
      ) : null}
      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
