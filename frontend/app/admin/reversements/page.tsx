"use client";

// Bug corrigé : cartes KPI 100% maquette (payoutStats factices) — câblées
// sur GET /admin/payouts/stats.

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { PayoutsExplorer } from "@/components/admin/payouts-explorer";
import { getPayoutStats } from "@/lib/api/admin";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function AdminPayoutsPage() {
  const [stats, setStats] = useState<{ pending_total: number; paid_this_month_total: number; blocked_total: number } | null>(null);

  useEffect(() => {
    getPayoutStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const cards = stats
    ? [
        { id: "pending", label: "En attente", value: currency.format(stats.pending_total), valueClassName: "text-amber-400" },
        { id: "paid", label: "Versé ce mois", value: currency.format(stats.paid_this_month_total), valueClassName: "text-emerald-400" },
        { id: "blocked", label: "Bloqués", value: currency.format(stats.blocked_total), valueClassName: "text-red-400" },
      ]
    : [];

  return (
    <AdminShell active="/admin/reversements">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reversements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Suivi des versements aux organisateurs — un reversement anticipé est
          bloqué avant J+2 après la fin de l&apos;événement (CDC 7.2).
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats === null
          ? [0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/5 bg-[#12101c]" />
            ))
          : cards.map((stat) => <AdminStatCard key={stat.id} stat={stat} />)}
      </div>

      <PayoutsExplorer />
    </AdminShell>
  );
}
