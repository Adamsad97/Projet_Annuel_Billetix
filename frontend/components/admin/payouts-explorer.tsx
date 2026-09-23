"use client";

// Bug corrigé : page 100% maquette (adminPayouts factices) — câblée sur
// GET /admin/payouts (payment-service, enrichi organisateur/événement côté
// gateway) et les actions déjà exposées (block/unblock/approve-early).

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { PayoutRow } from "@/components/admin/payout-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  approveEarlyPayout,
  blockPayout,
  listPayouts,
  unblockPayout,
  type ApiPayout,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const statusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "PENDING", label: "En attente" },
  { id: "PROCESSING", label: "En cours" },
  { id: "COMPLETED", label: "Versés" },
  { id: "BLOCKED", label: "Bloqués" },
  { id: "FAILED", label: "Échoués" },
];

export function PayoutsExplorer() {
  const [status, setStatus] = useState("all");
  const [payouts, setPayouts] = useState<ApiPayout[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function load() {
    listPayouts({ status: status === "all" ? undefined : status, limit: 50 })
      .then((result) => {
        setPayouts(result.data);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les reversements."));
  }

  useEffect(load, [status]);

  function handleBlock(payout: ApiPayout) {
    setDialog({
      title: `Bloquer le reversement de ${payout.organizer_name} ?`,
      message: "Le versement ne sera pas déclenché tant que le blocage n'est pas levé.",
      confirmLabel: "Bloquer",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du blocage…",
      onConfirm: async (reason) => {
        setBusyId(payout.id);
        try {
          await blockPayout(payout.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de bloquer ce reversement.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleUnblock(payout: ApiPayout) {
    setDialog({
      title: "Débloquer ce reversement ?",
      message: "Il reprendra son cours normal (versé au prochain passage automatique).",
      confirmLabel: "Débloquer",
      onConfirm: async () => {
        setBusyId(payout.id);
        try {
          await unblockPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de débloquer ce reversement.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleApproveEarly(payout: ApiPayout) {
    setDialog({
      title: "Approuver la demande de reversement anticipé ?",
      message: `${payout.organizer_name} sera versé sans attendre l'échéance normale.`,
      confirmLabel: "Approuver",
      onConfirm: async () => {
        setBusyId(payout.id);
        try {
          await approveEarlyPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible d'approuver cette demande.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={statusFilters} active={status} onChange={setStatus} />

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {payouts === null ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
        ) : payouts.length > 0 ? (
          payouts.map((payout) => (
            <PayoutRow
              key={payout.id}
              payout={payout}
              busy={busyId === payout.id}
              onBlock={() => handleBlock(payout)}
              onUnblock={() => handleUnblock(payout)}
              onApproveEarly={() => handleApproveEarly(payout)}
            />
          ))
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun reversement dans cette catégorie.</p>
        )}
      </div>

      {payouts && payouts.length > 0 ? (
        <p className="text-center text-xs text-gray-600">
          {payouts.length} sur {total} reversement{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
