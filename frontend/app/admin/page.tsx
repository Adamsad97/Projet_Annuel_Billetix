"use client";

// Bug corrigé : page 100% maquette (adminStats/validationQueue factices) —
// câblée sur GET /admin/dashboard et GET /admin/events/pending
// (api-gateway), déjà entièrement construits côté backend (KPIs, alertes
// seuils litiges/remboursements) mais jamais appelés par le frontend
// jusqu'ici.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ValidationRow } from "@/components/admin/validation-row";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { approveEvent, getAdminDashboard, getPendingEvents, rejectEvent, type ApiAdminDashboard, type ApiPendingEvent } from "@/lib/api/admin";
import { apiDashboardToAdminStats } from "@/lib/mappers/admin-mappers";
import { ApiError } from "@/lib/api/http-error";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<ApiAdminDashboard | undefined>(undefined);
  const [pending, setPending] = useState<ApiPendingEvent[] | undefined>(undefined);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadPending() {
    getPendingEvents()
      .then(setPending)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger la file de validation."));
  }

  useEffect(() => {
    getAdminDashboard()
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger le dashboard."));
    listCategories().then(setCategories).catch(() => setCategories([]));
    loadPending();
  }, []);

  async function handleApprove(id: string) {
    if (!confirm("Valider cet événement ? Il sera publié immédiatement sur le catalogue.")) return;
    setBusyId(id);
    try {
      await approveEvent(id);
      setPending((prev) => prev?.filter((event) => event.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de valider cet événement.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Motif du rejet (communiqué à l'organisateur) :");
    if (!reason) return;
    setBusyId(id);
    try {
      await rejectEvent(id, reason);
      setPending((prev) => prev?.filter((event) => event.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de rejeter cet événement.");
    } finally {
      setBusyId(null);
    }
  }

  const categoryByCode = new Map(categories.map((category) => [category.code, category]));

  return (
    <AdminShell active="/admin">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
      >
        ← Accueil
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Dashboard administrateur</h1>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {dashboard === undefined ? (
        <p className="text-center text-sm text-gray-500">Chargement…</p>
      ) : (
        <>
          {dashboard.alerts.length > 0 ? (
            <div className="mb-6 flex flex-col gap-2">
              {dashboard.alerts.map((alert) => (
                <div
                  key={alert.type}
                  className={
                    alert.severity === "critical"
                      ? "rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300"
                      : "rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200"
                  }
                >
                  ⚠️ {alert.message}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {apiDashboardToAdminStats(dashboard).map((stat) => (
              <AdminStatCard key={stat.id} stat={stat} />
            ))}
          </div>
        </>
      )}

      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          File de validation {pending !== undefined ? `— ${pending.length} événement(s) en attente` : ""}
        </h2>
        <Link href="/admin/validation" className="text-sm font-medium text-violet-400 hover:text-violet-300">
          Tout voir →
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {pending === undefined ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
        ) : pending.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun événement en attente.</p>
        ) : (
          pending
            .slice(0, 5)
            .map((event) => (
              <ValidationRow
                key={event.id}
                event={event}
                categoryEmoji={categoryByCode.get(event.category)?.emoji ?? "🎫"}
                categoryLabel={categoryByCode.get(event.category)?.label ?? event.category}
                onApprove={handleApprove}
                onReject={handleReject}
                busy={busyId === event.id}
              />
            ))
        )}
      </div>
    </AdminShell>
  );
}
