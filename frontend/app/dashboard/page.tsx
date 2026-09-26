"use client";

// Bug corrigé : page 100% maquette (stats et événements factices) — câblée
// sur GET /events/me/dashboard (api-gateway), déjà entièrement construit
// côté backend mais jamais appelé par le frontend jusqu'ici.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { OrganizerEventRow } from "@/components/dashboard/organizer-event-row";
import { getOrganizerDashboard, getMyPayouts, type ApiOrganizerDashboard } from "@/lib/api/organizer";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { apiEventSummaryToOrganizerEvent, buildOrganizerDashboardStats } from "@/lib/mappers/dashboard-mappers";
import { getStoredUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/http-error";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<ApiOrganizerDashboard | undefined>(undefined);
  const [categoriesByCode, setCategoriesByCode] = useState<Map<string, ApiCategory>>(new Map());
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(getStoredUser()?.first_name ?? "");

    let cancelled = false;
    Promise.all([
      getOrganizerDashboard(),
      getMyPayouts().catch(() => []),
      // listActive() suffit : un événement déjà créé garde toujours un code
      // valide, jamais désactivé rétroactivement (cf. CategoryService.remove).
      listCategories().catch(() => []),
    ])
      .then(([dashboardResult, payouts, categories]) => {
        if (cancelled) return;
        setDashboard(dashboardResult);
        setCategoriesByCode(new Map(categories.map((category) => [category.code, category])));
        const nextPending = payouts
          .filter((payout) => payout.status === "PENDING")
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
        setNextPayoutDate(nextPending?.scheduled_at ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Impossible de charger le tableau de bord.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Accueil
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-1">Tableau de bord</h1>
            <p className="mt-1 text-sm text-accent">
              Bonjour {firstName || ""} 👋 — performances tous événements confondus
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard/paiements"
              className="rounded-full border border-hairline-3 px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              💳 Paiements
            </Link>
            <Link
              href="/creer-evenement"
              className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
            >
              + Créer un événement
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : dashboard === undefined ? (
          <p className="text-center text-sm text-ink-5">Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {buildOrganizerDashboardStats(dashboard, nextPayoutDate).map((stat) => (
                <StatCard key={stat.id} stat={stat} />
              ))}
            </div>

            <div className="mb-4 mt-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-1">Mes événements</h2>
              <Link
                href="/dashboard/finances"
                className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >
                Finances →
              </Link>
            </div>

            {dashboard.events.length === 0 ? (
              <div className="rounded-2xl border border-hairline-1 bg-card px-5 py-10 text-center text-sm text-ink-5">
                Tu n&apos;as encore créé aucun événement.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
                {dashboard.events.map((event) => (
                  <OrganizerEventRow
                    key={event.id}
                    event={apiEventSummaryToOrganizerEvent(event, categoriesByCode)}
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
