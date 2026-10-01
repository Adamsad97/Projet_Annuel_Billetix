"use client";

// Tableau de bord admin câblé sur GET /admin/dashboard et GET /admin/events/pending.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ValidationRow } from "@/components/admin/validation-row";
import { RevenueTrendChart } from "@/components/admin/revenue-trend-chart";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { approveEvent, getAdminDashboard, getPendingEvents, rejectEvent, type ApiAdminDashboard, type ApiPendingEvent } from "@/lib/api/admin";
import { apiDashboardToAdminStats } from "@/lib/mappers/admin-mappers";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<ApiAdminDashboard | undefined>(undefined);
  const [pending, setPending] = useState<ApiPendingEvent[] | undefined>(undefined);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

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

  function handleApprove(id: string) {
    setDialog({
      title: "Valider cet événement ?",
      message: "Il sera publié immédiatement et visible par tous.",
      confirmLabel: "✓ Valider",
      onConfirm: async () => {
        setBusyId(id);
        try {
          await approveEvent(id);
          setPending((prev) => prev?.filter((event) => event.id !== id));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de valider cet événement.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleReject(id: string) {
    setDialog({
      title: "Rejeter cet événement",
      message: "Le motif sera communiqué à l'organisateur.",
      confirmLabel: "✕ Rejeter",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du rejet…",
      onConfirm: async (reason) => {
        setBusyId(id);
        try {
          await rejectEvent(id, reason!);
          setPending((prev) => prev?.filter((event) => event.id !== id));
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de rejeter cet événement.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  const categoryByCode = new Map(categories.map((category) => [category.code, category]));

  return (
    <AdminShell active="/admin">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink-1">Dashboard administrateur</h1>
      </div>

      {error ? (
        <Alert className="mb-6">
          {error}
        </Alert>
      ) : null}

      {dashboard === undefined ? (
        <MutedMessage />
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

          <h2 className="mb-3 mt-10 text-lg font-bold text-ink-1">Ventes</h2>
          <RevenueTrendChart />
        </>
      )}

      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink-1">
          File de validation {pending !== undefined ? `— ${pending.length} événement(s) en attente` : ""}
        </h2>
        <Link href="/admin/validation" className="text-sm font-medium text-link hover:text-link-hover">
          Tout voir →
        </Link>
      </div>

      <div className={cardClass("overflow-hidden")}>
        {pending === undefined ? (
          <MutedMessage variant="list" />
        ) : pending.length === 0 ? (
          <MutedMessage variant="list">Aucun événement en attente.</MutedMessage>
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

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
