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
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <Link
          href={`/billets/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Retour au billet
        </Link>

        {ticket === undefined ? (
          <p className="text-center text-sm text-gray-500">Chargement…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : ticket === null ? (
          <div className="rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-white">Page introuvable</h1>
            <p className="mt-2 text-sm text-gray-500">
              Ce billet n&apos;existe pas, ou la page que tu cherches a changé d&apos;adresse.
            </p>
          </div>
        ) : ticket.status === "valid" ? (
          <ResellForm ticket={ticket} />
        ) : (
          <p className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-8 text-center text-sm text-gray-500">
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
