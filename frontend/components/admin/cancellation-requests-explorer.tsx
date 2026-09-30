"use client";

// Liste des demandes d'annulation ou de report (GET /admin/cancellation-requests). Le
// traitement (échange, accepter, refuser) se fait sur la fiche de l'événement.

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import {
  cancellationStatusLabels,
  changeRequestKindLabels,
  listCancellationRequests,
  type ApiCancellationRequest,
  type CancellationStatus,
} from "@/lib/api/cancellation";
import { ApiError } from "@/lib/api/http-error";
import { dateTime } from "@/lib/format/dates";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";

const PAGE_SIZE = 50;

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
        <Alert>{error}</Alert>
      ) : null}

      {requests ? (
        <p className="text-sm text-ink-5" role="status">
          {total} demande{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <div className={cardClass("overflow-hidden")}>
        {requests === null ? (
          <MutedMessage variant="list" />
        ) : requests.length === 0 ? (
          <MutedMessage variant="list">
            {status === "PENDING" ? "Aucune demande en attente." : "Aucune demande dans cette catégorie."}
          </MutedMessage>
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
                    <Badge tone={changeRequestKindLabels[request.kind ?? "CANCELLATION"].className}>
                      {changeRequestKindLabels[request.kind ?? "CANCELLATION"].badge}
                    </Badge>
                    <Badge tone={badge.className}>{badge.label}</Badge>
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
        <LoadMoreButton onClick={loadMore} loading={loadingMore} />
      ) : null}
    </div>
  );
}
