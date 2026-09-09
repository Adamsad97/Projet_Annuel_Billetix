"use client";

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { ValidationRow } from "@/components/admin/validation-row";
import { ValidationHistoryRow } from "@/components/admin/validation-history-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEvent } from "@/lib/api/events";
import {
  approveEvent,
  getAuditLogs,
  getPendingEvents,
  rejectEvent,
  type ApiPendingEvent,
} from "@/lib/api/admin";
import { auditLogToValidationHistoryEntry, type ValidationHistoryEntry } from "@/lib/mappers/admin-mappers";
import { ApiError } from "@/lib/api/http-error";

async function loadHistory(
  action: "EVENT_APPROVED" | "EVENT_REJECTED",
  categoryByCode: Map<string, ApiCategory>,
): Promise<ValidationHistoryEntry[]> {
  const logs = await getAuditLogs({ entity_type: "EVENT", action, limit: 20 });
  const uniqueEventIds = [...new Set(logs.map((log) => log.entity_id).filter((id): id is string => !!id))];
  const events = await Promise.all(uniqueEventIds.map((id) => getEvent(id).catch(() => undefined)));
  const eventById = new Map(events.filter((event) => event !== undefined).map((event) => [event.id, event]));

  return logs.map((log) => {
    const event = log.entity_id ? eventById.get(log.entity_id) : undefined;
    const emoji = event ? (categoryByCode.get(event.category)?.emoji ?? "🎫") : "🎫";
    return auditLogToValidationHistoryEntry(log, event, emoji);
  });
}

export function ValidationTabs() {
  const [tab, setTab] = useState("pending");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [pending, setPending] = useState<ApiPendingEvent[] | undefined>(undefined);
  const [approved, setApproved] = useState<ValidationHistoryEntry[] | undefined>(undefined);
  const [rejected, setRejected] = useState<ValidationHistoryEntry[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  const categoryByCode = new Map(categories.map((category) => [category.code, category]));

  function loadPending() {
    getPendingEvents()
      .then(setPending)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger la file de validation."));
  }

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    loadPending();
  }, []);

  useEffect(() => {
    if (tab === "approved" && approved === undefined && categories.length > 0) {
      loadHistory("EVENT_APPROVED", categoryByCode)
        .then(setApproved)
        .catch(() => setApproved([]));
    }
    if (tab === "rejected" && rejected === undefined && categories.length > 0) {
      loadHistory("EVENT_REJECTED", categoryByCode)
        .then(setRejected)
        .catch(() => setRejected([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryByCode recréée à chaque rendu, categories.length suffit comme dépendance stable
  }, [tab, categories.length]);

  function handleApprove(id: string) {
    setDialog({
      title: "Valider cet événement ?",
      message: "Il sera publié immédiatement sur le catalogue.",
      confirmLabel: "✓ Valider",
      onConfirm: async () => {
        setBusyId(id);
        setError(null);
        try {
          await approveEvent(id);
          setPending((prev) => prev?.filter((event) => event.id !== id));
          setApproved(undefined);
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
        setError(null);
        try {
          await rejectEvent(id, reason!);
          setPending((prev) => prev?.filter((event) => event.id !== id));
          setRejected(undefined);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de rejeter cet événement.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  const tabs = [
    { id: "pending", label: "En attente", count: pending?.length },
    { id: "approved", label: "Validés", count: approved?.length },
    { id: "rejected", label: "Rejetés", count: rejected?.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={tabs} active={tab} onChange={setTab} />

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {tab === "pending" ? (
          pending === undefined ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
          ) : pending.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun événement en attente.</p>
          ) : (
            pending.map((event) => (
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
          )
        ) : null}

        {tab === "approved" ? (
          approved === undefined ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
          ) : approved.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun événement validé récemment.</p>
          ) : (
            approved.map((entry) => <ValidationHistoryRow key={entry.id} entry={entry} outcome="approved" />)
          )
        ) : null}

        {tab === "rejected" ? (
          rejected === undefined ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
          ) : rejected.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun événement rejeté récemment.</p>
          ) : (
            rejected.map((entry) => <ValidationHistoryRow key={entry.id} entry={entry} outcome="rejected" />)
          )
        ) : null}
      </div>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
