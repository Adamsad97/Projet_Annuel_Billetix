"use client";

// Bug corrigé : page 100% maquette — ne reconnaissait que 5 identifiants
// factices ("nuit-electronique-standard", etc.), donc "Page introuvable"
// systématique pour tout vrai billet. Câblée sur ticket-service.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { TicketVisual } from "@/components/tickets/ticket-visual";
import { ResaleManagePanel } from "@/components/tickets/resale-manage-panel";
import { getTicket } from "@/lib/api/tickets";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/mock/ticket-detail";
import { ApiError } from "@/lib/api/http-error";

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<TicketDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
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
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Recharge le billet après un retrait de vente réussi (repasse en "valid").
  function reloadTicket() {
    setTicket(undefined);
    getTicket(id)
      .then((apiTicket) => setTicket(apiTicketToDetail(apiTicket)))
      .catch(() => setError("Impossible de recharger ce billet."));
  }

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <Link
          href="/profil/billets"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Mes billets
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
        ) : (
          <>
            <TicketVisual ticket={ticket} />

            <div className="mt-6 flex flex-col gap-3">
              {ticket.pdfUrl ? (
                <a
                  href={ticket.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-full border border-white/15 py-3 text-center text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
                >
                  ⬇️ Télécharger le PDF
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Le PDF est encore en cours de génération, réessaie dans quelques instants"
                  className="w-full cursor-not-allowed rounded-full border border-white/10 py-3 text-sm font-medium text-gray-500"
                >
                  ⬇️ PDF en cours de génération…
                </button>
              )}

              {ticket.status === "valid" ? (
                <Link
                  href={`/billets/${id}/revendre`}
                  className="w-full rounded-full bg-white/5 py-3 text-center text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
                >
                  🔄 Revendre ce billet
                </Link>
              ) : ticket.status === "for_resale" ? (
                <ResaleManagePanel ticketId={id} onWithdrawn={reloadTicket} />
              ) : null}

              <Link
                href={`/profil/commandes/${ticket.orderId}`}
                className="w-full rounded-full py-3 text-center text-sm font-medium text-gray-400 transition-colors hover:text-gray-200"
              >
                📦 Voir la commande associée
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
