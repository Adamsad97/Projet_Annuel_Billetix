"use client";

// Bug corrigé : page 100% maquette (stats et événements factices) — câblée
// sur GET /events/me/dashboard (api-gateway), déjà entièrement construit
// côté backend mais jamais appelé par le frontend jusqu'ici.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { OrganizerEventsExplorer } from "@/components/dashboard/organizer-events-explorer";
import { getOrganizerDashboard, getMyPayouts, type ApiOrganizerDashboard } from "@/lib/api/organizer";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { buildOrganizerDashboardStats } from "@/lib/mappers/dashboard-mappers";
import { getStoredUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/http-error";
import { getOrganizerProfile } from "@/lib/api/organizer-profile";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<ApiOrganizerDashboard | undefined>(undefined);
  const [categoriesByCode, setCategoriesByCode] = useState<Map<string, ApiCategory>>(new Map());
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  // false : aucun profil organisateur (compte créé sans), à compléter.
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(getStoredUser()?.first_name ?? "");

    let cancelled = false;
    getOrganizerProfile()
      .then(() => !cancelled && setHasProfile(true))
      .catch((err) => !cancelled && setHasProfile(!(err instanceof ApiError && err.status === 404)));
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
    <PageShell width="7xl">
      <BackLink href="/">Accueil</BackLink>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-1">Tableau de bord</h1>
          <p className="mt-1 text-sm text-accent">
            Bonjour {firstName || ""} 👋 — performances tous événements confondus
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/profil"
            className={buttonClass("secondary", "rounded-full px-4 py-2.5 text-sm")}
          >
            🏷️ Mon profil
          </Link>
          <Link
            href="/dashboard/paiements"
            className={buttonClass("secondary", "rounded-full px-4 py-2.5 text-sm")}
          >
            💳 Paiements
          </Link>
          <Link
            href="/creer-evenement"
            className={buttonClass("primary", "rounded-full px-5 py-2.5 text-sm")}
          >
            + Créer un événement
          </Link>
        </div>
      </div>

      {hasProfile === false ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink-1">Complétez votre profil organisateur</p>
            <p className="mt-0.5 text-sm text-ink-3">
              Nom public et présentation de votre structure : nécessaires pour la vérification d&apos;identité et
              les reversements.
            </p>
          </div>
          <Link
            href="/dashboard/profil"
            className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Compléter mon profil →
          </Link>
        </div>
      ) : null}

      {error ? (
        <Alert centered>
          {error}
        </Alert>
      ) : dashboard === undefined ? (
        <MutedMessage />
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
              className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
            >
              Finances →
            </Link>
          </div>

          <OrganizerEventsExplorer events={dashboard.events} categoriesByCode={categoriesByCode} />
        </>
      )}
    </PageShell>
  );
}
