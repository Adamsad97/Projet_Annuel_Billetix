"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { DisputeRow } from "@/components/admin/dispute-row";
import { listDisputes, type ApiDispute } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { disputeStatusFilters } from "@/lib/constants/admin-disputes";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";

export function DisputesExplorer() {
  const [status, setStatus] = useState("all");
  const [disputes, setDisputes] = useState<ApiDispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDisputes()
      .then(setDisputes)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les litiges."));
  }, []);

  const filtered = useMemo(() => {
    if (!disputes) return [];
    return status === "all" ? disputes : disputes.filter((dispute) => dispute.status === status);
  }, [disputes, status]);

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={disputeStatusFilters} active={status} onChange={setStatus} />

      <div className={cardClass("overflow-hidden")}>
        {disputes === null ? (
          <MutedMessage variant="list">{error ?? "Chargement…"}</MutedMessage>
        ) : filtered.length > 0 ? (
          filtered.map((dispute) => <DisputeRow key={dispute.id} dispute={dispute} />)
        ) : (
          <MutedMessage variant="list">
            {status === "all" ? "Aucun litige pour le moment." : "Aucun litige dans cette catégorie."}
          </MutedMessage>
        )}
      </div>
    </div>
  );
}
