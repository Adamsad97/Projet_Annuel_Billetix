"use client";

// Bug corrigé : cartes KPI 100% maquette (payoutStats factices) — câblées
// sur GET /admin/payouts/stats.

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { BankTransfersPanel } from "@/components/admin/bank-transfers-panel";
import { PayoutsExplorer } from "@/components/admin/payouts-explorer";
import { getPayoutStats } from "@/lib/api/admin";
import { euros as currency } from "@/lib/format/money";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export default function AdminPayoutsPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPayoutStats>> | null>(null);
  // Virement confirmé ou annulé : KPI et liste rechargés.
  const [version, setVersion] = useState(0);

  const loadStats = useCallback(() => {
    getPayoutStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(loadStats, [loadStats]);

  const cards = stats
    ? [
        { id: "pending", label: t("En attente"), value: currency.format(stats.pending_total), valueClassName: "text-amber-400" },
        {
          id: "to-transfer",
          label: t("À virer ({to_transfer_count})", { to_transfer_count: stats.to_transfer_count }),
          value: currency.format(stats.to_transfer_total),
          valueClassName: "text-blue-400",
        },
        { id: "paid", label: t("Versé ce mois"), value: currency.format(stats.paid_this_month_total), valueClassName: "text-emerald-400" },
        { id: "blocked", label: t("Bloqués"), value: currency.format(stats.blocked_total), valueClassName: "text-red-400" },
      ]
    : [];

  return (
    <AdminShell active="/admin/reversements">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Reversements")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Suivi des versements aux organisateurs — un reversement anticipé est bloqué avant J+2 après la fin de l'événement (CDC 7.2).")}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats === null
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className={cardClass("h-24 animate-pulse")} />
            ))
          : cards.map((stat) => <AdminStatCard key={stat.id} stat={stat} />)}
      </div>

      <BankTransfersPanel
        onChange={() => {
          loadStats();
          setVersion((current) => current + 1);
        }}
      />

      <PayoutsExplorer key={version} />
    </AdminShell>
  );
}
