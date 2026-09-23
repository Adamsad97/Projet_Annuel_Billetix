"use client";

// Bug corrigé : page 100% maquette (adminPayouts factices, IBAN affiché en
// clair alors que le backend le chiffre et ne le sélectionne jamais par
// défaut — select: false) — câblée sur GET /admin/payouts/:id.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { payoutStatusBadge } from "@/components/admin/payout-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  approveEarlyPayout,
  blockPayout,
  getPayout,
  processPayout,
  unblockPayout,
  type ApiPayoutDetail,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AdminPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payout, setPayout] = useState<ApiPayoutDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function load() {
    getPayout(id)
      .then(setPayout)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setPayout(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger ce reversement.");
        }
      });
  }

  useEffect(load, [id]);

  function handleBlock() {
    if (!payout) return;
    setDialog({
      title: "Bloquer ce reversement ?",
      message: "Le versement ne sera pas déclenché tant que le blocage n'est pas levé.",
      confirmLabel: "Bloquer",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du blocage…",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          await blockPayout(payout.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de bloquer ce reversement.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleUnblock() {
    if (!payout) return;
    setDialog({
      title: "Débloquer ce reversement ?",
      message: "Il reprendra son cours normal.",
      confirmLabel: "Débloquer",
      onConfirm: async () => {
        setBusy(true);
        try {
          await unblockPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de débloquer ce reversement.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleProcess() {
    if (!payout) return;
    setDialog({
      title: "Déclencher le virement maintenant ?",
      message: "Le versement Stripe est initié immédiatement, sans attendre le passage automatique quotidien.",
      confirmLabel: "Déclencher",
      onConfirm: async () => {
        setBusy(true);
        try {
          await processPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de déclencher ce virement.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleApproveEarly() {
    if (!payout) return;
    setDialog({
      title: "Approuver la demande de reversement anticipé ?",
      message: `${payout.organizer_name} sera versé sans attendre l'échéance normale.`,
      confirmLabel: "Approuver",
      onConfirm: async () => {
        setBusy(true);
        try {
          await approveEarlyPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible d'approuver cette demande.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <AdminShell active="/admin/reversements">
      <Link
        href="/admin/reversements"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
      >
        ← Reversements
      </Link>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      {payout === undefined ? (
        <p className="text-center text-sm text-gray-500">Chargement…</p>
      ) : payout === null ? (
        <div className="rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
          <div className="mb-3 text-4xl">💸</div>
          <h1 className="text-lg font-bold text-white">Reversement introuvable</h1>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">
                {payout.event_name} — {payout.organizer_name}
              </h1>
              <p className="text-sm text-gray-500">
                {payout.organizer_email} · Prévu le {dateFormatter.format(new Date(payout.scheduled_at))}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${payoutStatusBadge[payout.status].className}`}>
                {payoutStatusBadge[payout.status].label}
              </span>
              {payout.requested_early_at && !payout.early_request_approved_by ? (
                <span className="ml-2 inline-block rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
                  Demande de reversement anticipé en attente
                </span>
              ) : null}
            </div>
            <span className="text-2xl font-bold text-white">{currency.format(payout.net_amount)}</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-200">Détail du calcul</h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Montant brut</span>
                <span className="text-gray-300">{currency.format(payout.gross_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Commission plateforme</span>
                <span className="text-amber-400">− {currency.format(payout.commission_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Frais de paiement</span>
                <span className="text-amber-400">− {currency.format(payout.payment_fees_amount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="font-bold text-white">Net à verser</span>
                <span className="font-bold text-white">{currency.format(payout.net_amount)}</span>
              </div>
            </div>

            {payout.bank_owner_name ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Titulaire du compte bancaire</p>
                <p className="text-sm text-gray-300">{payout.bank_owner_name}</p>
                <p className="mt-1 text-xs text-gray-600">
                  L&apos;IBAN est chiffré et utilisé uniquement par Stripe pour le virement — non affiché ici.
                </p>
              </div>
            ) : null}

            {payout.stripe_transfer_id ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Référence virement Stripe</p>
                <p className="font-mono text-sm text-gray-300">{payout.stripe_transfer_id}</p>
              </div>
            ) : null}

            {payout.blocked_reason ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-red-300">
                Motif du blocage : {payout.blocked_reason}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {payout.requested_early_at && !payout.early_request_approved_by ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleApproveEarly}
                className="rounded-full bg-emerald-500/15 px-5 py-2.5 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              >
                ✓ Approuver l&apos;anticipation
              </button>
            ) : null}
            {payout.status === "PENDING" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleProcess}
                  className="rounded-full bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  Déclencher le virement maintenant
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleBlock}
                  className="rounded-full bg-red-500/15 px-5 py-2.5 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  Bloquer
                </button>
              </>
            ) : payout.status === "BLOCKED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleUnblock}
                className="rounded-full bg-emerald-500/15 px-5 py-2.5 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              >
                Débloquer
              </button>
            ) : null}
          </div>
        </>
      )}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
