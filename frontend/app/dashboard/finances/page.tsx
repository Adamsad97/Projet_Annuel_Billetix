"use client";

// Finances câblées sur le solde, les reversements et la demande anticipée (CDC §7.2, dès J+2).

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { OrganizerPayoutsExplorer } from "@/components/dashboard/organizer-payouts-explorer";
import {
  getMyBalance,
  getMyPayouts,
  requestEarlyPayout,
  type ApiOrganizerBalance,
  type ApiPayout,
} from "@/lib/api/organizer";
import { ApiError } from "@/lib/api/http-error";
import { euros as currency } from "@/lib/format/money";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n/translate";

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
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger les finances.")));
  }

  useEffect(load, []);

  async function handleRequestEarly(payoutId: string) {
    setBusyId(payoutId);
    setError(null);
    try {
      await requestEarlyPayout(payoutId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Impossible de demander ce versement anticipé."));
    } finally {
      setBusyId(null);
    }
  }

  const totalGross = payouts?.reduce((sum, payout) => sum + Number(payout.gross_amount), 0) ?? 0;
  const totalCommission = payouts?.reduce((sum, payout) => sum + Number(payout.commission_amount), 0) ?? 0;

  return (
    <PageShell width="5xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-1">{t("Finances")}</h1>
          <p className="mt-1 text-sm text-ink-5">{t("Détail des reversements par événement.")}</p>
        </div>
        <Link
          href="/dashboard"
          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
        >{t("← Tableau de bord")}</Link>
      </div>

      {error ? (
        <Alert className="mb-6">
          {error}
        </Alert>
      ) : null}

      {balance === undefined || payouts === undefined ? (
        <MutedMessage />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard stat={{ id: "gross", label: t("Total encaissé (brut)"), value: currency.format(totalGross), accent: "bg-blue-500" }} />
            <StatCard
              stat={{
                id: "commission",
                label: t("Commissions prélevées"),
                value: currency.format(totalCommission),
                accent: "bg-amber-500",
              }}
            />
            <StatCard
              stat={{
                id: "earned",
                label: t("Déjà versé"),
                value: currency.format(balance.total_earned),
                accent: "bg-emerald-500",
              }}
            />
            <StatCard
              stat={{
                id: "pending",
                label: t("En attente de versement"),
                value: currency.format(balance.pending_balance),
                accent: "bg-blue-500",
              }}
            />
          </div>

          <OrganizerPayoutsExplorer payouts={payouts} busyId={busyId} onRequestEarly={handleRequestEarly} />
        </>
      )}
    </PageShell>
  );
}
