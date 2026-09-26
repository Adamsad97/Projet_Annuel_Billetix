"use client";

// Bug corrigé : page 100% maquette — cherchait l'ID dans un objet de 5
// billets factices, donc "Page introuvable" systématique pour tout vrai
// billet. Câblée sur ticket-service, comme /billets/[id].

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { ResellForm } from "@/components/tickets/resell-form";
import { getTicket } from "@/lib/api/tickets";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/mock/ticket-detail";
import { ApiError } from "@/lib/api/http-error";

export default function ResellTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        if (err instanceof ApiError && err.status === 404) {
          setTicket(null);
        } else {
          setError(
            err instanceof ApiError ? err.message : "Impossible de charger ce billet.",
          );
        }
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

        {ticket === undefined ? (
          <p className="text-center text-sm text-ink-5">Chargement…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : ticket === null ? (
          <div className="rounded-2xl border border-hairline-1 bg-card p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-ink-1">Page introuvable</h1>
            <p className="mt-2 text-sm text-ink-5">
              Ce billet n&apos;existe pas, ou la page que vous cherchez a changé d&apos;adresse.
            </p>
          </div>
        ) : ticket.status === "valid" ? (
          <ResellForm ticket={ticket} />
        ) : (
          <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-8 text-center text-sm text-ink-5">
            {ticket.status === "for_resale"
              ? "Ce billet est déjà en cours de revente."
              : ticket.status === "used"
                ? "Ce billet a déjà été utilisé et ne peut pas être remis en revente."
                : "Ce billet a été annulé ou remboursé et ne peut pas être remis en revente."}
          </p>
        )}
      </main>
    </div>
  );
}
