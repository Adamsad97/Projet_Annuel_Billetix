"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { GiftForm } from "@/components/tickets/gift-form";
import { getTicket } from "@/lib/api/tickets";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/mock/ticket-detail";
import { ApiError } from "@/lib/api/http-error";

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
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <Link
          href={`/billets/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Retour au billet
        </Link>

        {ticket === undefined && !error ? (
          <p className="text-center text-sm text-ink-5">Chargement…</p>
        ) : error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-5 py-6 text-center text-sm text-danger">{error}</div>
        ) : ticket === null || ticket === undefined ? (
          <div className="rounded-2xl border border-hairline-1 bg-card p-8 text-center">
            <h1 className="text-lg font-bold text-ink-1">Page introuvable</h1>
            <p className="mt-2 text-sm text-ink-5">Ce billet n&apos;existe pas ou ne t&apos;appartient plus.</p>
          </div>
        ) : ticket.status === "valid" ? (
          <GiftForm ticket={ticket} />
        ) : (
          <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-8 text-center text-sm text-ink-5">
            {ticket.status === "for_resale"
              ? "Ce billet est en revente : retirez-le de la revente avant de l'offrir."
              : "Ce billet n'est plus utilisable : il ne peut pas être offert."}
          </p>
        )}
      </main>
    </div>
  );
}
