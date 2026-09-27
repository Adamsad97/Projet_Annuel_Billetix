"use client";

// Liste des demandes d'annulation (GET /admin/cancellation-requests). Le
// traitement (échange, accepter, refuser) se fait sur la fiche de l'événement.

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import {
  cancellationStatusLabels,
  listCancellationRequests,
  type ApiCancellationRequest,
  type CancellationStatus,
} from "@/lib/api/cancellation";
import { ApiError } from "@/lib/api/http-error";

const PAGE_SIZE = 50;
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const statusFilters: { id: "all" | CancellationStatus; label: string }[] = [
  { id: "PENDING", label: "En attente" },
  { id: "all", label: "Toutes" },
  { id: "APPROVED", label: "Acceptées" },
  { id: "REJECTED", label: "Refusées" },
  { id: "WITHDRAWN", label: "Retirées" },
];

export function CancellationRequestsExplorer() {
  const [status, setStatus] = useState<"all" | CancellationStatus>("PENDING");
  const [requests, setRequests] = useState<ApiCancellationRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = (offset: number) =>
    listCancellationRequests({ status: status === "all" ? undefined : status, limit: PAGE_SIZE, offset });

  useEffect(() => {
    query(0)
      .then((result) => {
        setRequests(result.data);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les demandes."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function loadMore() {
    if (!requests) return;
    setLoadingMore(true);
    try {
      const result = await query(requests.length);
      setRequests([...requests, ...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la suite.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={statusFilters} active={status} onChange={(id) => setStatus(id as "all" | CancellationStatus)} />

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      {requests ? (
        <p className="text-sm text-ink-5" role="status">
          {total} demande{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {requests === null ? (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Chargement…</p>
        ) : requests.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-5">
            {status === "PENDING" ? "Aucune demande en attente." : "Aucune demande dans cette catégorie."}
          </p>
        ) : (
          requests.map((request) => {
            const badge = cancellationStatusLabels[request.status];
            const lastMessage = request.messages[request.messages.length - 1];
            return (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-ink-1">{request.event_title ?? "Événement"}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-5">
                    {request.organizer_name ?? "Organisateur"} · demandée le {dateTime.format(new Date(request.created_at))} ·{" "}
                    {request.messages.length} message{request.messages.length > 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-3">
                    {lastMessage
                      ? `${lastMessage.author_role === "ADMIN" ? "Administration" : "Organisateur"} : ${lastMessage.message}`
                      : `Motif : ${request.reason}`}
                  </p>
                </div>
                <Link
                  href={`/admin/evenements/${request.event_id}`}
                  className="shrink-0 rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
                >
                  {request.status === "PENDING" ? "Traiter" : "Consulter"}
                </Link>
              </div>
            );
          })
        )}
      </div>

      {requests && requests.length < total ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-hairline-3 px-6 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : "Afficher plus"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
