"use client";

// Bug corrigé : page 100% maquette (financeStats/financeEntries factices) —
// câblée sur GET /payments/balance/me, GET /payments/payouts/me et
// POST /payments/payouts/:id/request-early (api-gateway), déjà entièrement
// construits côté backend (règle CDC §7.2 : demande anticipée possible à
// partir de J+2 après la fin de l'événement) mais jamais appelés par le
// frontend jusqu'ici.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { FinanceRow } from "@/components/dashboard/finance-row";
import {
  getMyBalance,
  getMyPayouts,
  requestEarlyPayout,
  type ApiOrganizerBalance,
  type ApiPayout,
} from "@/lib/api/organizer";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function DashboardFinancesPage() {
  const [balance, setBalance] = useState<ApiOrganizerBalance | undefined>(undefined);
  const [payouts, setPayouts] = useState<ApiPayout[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    Promise.all([getMyBalance(), getMyPayouts()])
      .then(([balanceResult, payoutsResult]) => {
        setBalance(balanceResult);
        setPayouts(payoutsResult);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les finances."));
  }

  useEffect(load, []);

  async function handleRequestEarly(payoutId: string) {
    setBusyId(payoutId);
    setError(null);
    try {
      await requestEarlyPayout(payoutId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de demander ce versement anticipé.");
    } finally {
      setBusyId(null);
    }
  }

  const totalGross = payouts?.reduce((sum, payout) => sum + Number(payout.gross_amount), 0) ?? 0;
  const totalCommission = payouts?.reduce((sum, payout) => sum + Number(payout.commission_amount), 0) ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Finances</h1>
            <p className="mt-1 text-sm text-gray-500">
              Détail des reversements par événement.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
          >
            ← Tableau de bord
          </Link>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {balance === undefined || payouts === undefined ? (
          <p className="text-center text-sm text-gray-500">Chargement…</p>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <StatCard stat={{ id: "gross", label: "Total encaissé (brut)", value: currency.format(totalGross), accent: "bg-violet-500" }} />
              <StatCard
                stat={{
                  id: "commission",
                  label: "Commissions prélevées",
                  value: currency.format(totalCommission),
                  accent: "bg-amber-500",
                }}
              />
              <StatCard
                stat={{
                  id: "earned",
                  label: "Déjà versé",
                  value: currency.format(balance.total_earned),
                  accent: "bg-emerald-500",
                }}
              />
              <StatCard
                stat={{
                  id: "pending",
                  label: "En attente de versement",
                  value: currency.format(balance.pending_balance),
                  accent: "bg-blue-500",
                }}
              />
            </div>

            {payouts.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-10 text-center text-sm text-gray-500">
                Aucun reversement pour le moment.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
                {payouts.map((payout) => (
                  <FinanceRow
                    key={payout.id}
                    payout={payout}
                    onRequestEarly={handleRequestEarly}
                    busy={busyId === payout.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
