"use client";

import { use, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { GiftForm } from "@/components/tickets/gift-form";
import { getTicket } from "@/lib/api/tickets";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/constants/ticket-detail";
import { ApiError } from "@/lib/api/http-error";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";

export default function GiftTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<TicketDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTicket(id)
      .then((apiTicket) => {
        if (!cancelled) setTicket(apiTicketToDetail(apiTicket));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setTicket(null);
        else setError(err instanceof ApiError ? err.message : "Impossible de charger ce billet.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PageShell width="md">
      <BackLink href={`/billets/${id}`}>Retour au billet</BackLink>

      {ticket === undefined && !error ? (
        <MutedMessage />
      ) : error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-5 py-6 text-center text-sm text-danger">{error}</div>
      ) : ticket === null || ticket === undefined ? (
        <div className={cardClass("p-8 text-center")}>
          <h1 className="text-lg font-bold text-ink-1">Page introuvable</h1>
          <p className="mt-2 text-sm text-ink-5">Ce billet n&apos;existe pas ou ne t&apos;appartient plus.</p>
        </div>
      ) : ticket.status === "valid" ? (
        <GiftForm ticket={ticket} />
      ) : (
        <p className={cardClass("px-5 py-8 text-center text-sm text-ink-5")}>
          {ticket.status === "for_resale"
            ? "Ce billet est en revente : retirez-le de la revente avant de l'offrir."
            : "Ce billet n'est plus utilisable : il ne peut pas être offert."}
        </p>
      )}
    </PageShell>
  );
}
