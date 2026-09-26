"use client";

// Bug corrigé : un billet "en cours de revente" n'affichait strictement
// aucune action possible (ni revendre, ni retirer) — une vraie impasse pour
// son propriétaire qui change d'avis.

import { useEffect, useState } from "react";
import { getActiveResaleForTicket, withdrawResale, type ApiResaleListing } from "@/lib/api/resale";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function ResaleManagePanel({
  ticketId,
  onWithdrawn,
}: {
  ticketId: string;
  onWithdrawn: () => void;
}) {
  const [listing, setListing] = useState<ApiResaleListing | null | undefined>(undefined);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveResaleForTicket(ticketId)
      .then((result) => {
        if (!cancelled) setListing(result);
      })
      .catch(() => {
        if (!cancelled) setListing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  function handleWithdraw() {
    if (!listing) return;
    setDialog({
      title: "Retirer ce billet de la vente ?",
      message: "L'annonce sera retirée du marketplace — le billet reste valable pour toi.",
      confirmLabel: "Retirer",
      onConfirm: async () => {
        setWithdrawing(true);
        setError(null);
        try {
          await withdrawResale(listing.id);
          onWithdrawn();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de retirer cette annonce.");
          setWithdrawing(false);
        }
      },
    });
  }

  if (listing === undefined) {
    return (
      <div className="w-full rounded-full border border-hairline-2 py-3 text-center text-sm text-ink-5">
        Chargement de l&apos;annonce…
      </div>
    );
  }

  if (!listing) {
    // Rare : le billet est FOR_RESALE côté ticket-service mais l'annonce
    // LISTED n'a pas été retrouvée (course avec une vente/retrait entre
    // deux requêtes) — rien à gérer, mieux vaut ne rien afficher que planter.
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-4">Mis en vente à</span>
        <span className="font-bold text-ink-1">{currency.format(Number(listing.resale_price))}</span>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={handleWithdraw}
        disabled={withdrawing}
        className="w-full rounded-full border border-hairline-3 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {withdrawing ? "Retrait…" : "↩️ Retirer de la vente"}
      </button>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
