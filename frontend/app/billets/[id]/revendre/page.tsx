"use client";

// Bug corrigé : page 100% maquette — cherchait l'ID dans un objet de 5
// billets factices, donc "Page introuvable" systématique pour tout vrai
// billet. Câblée sur ticket-service, comme /billets/[id].

import { use, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { ResellForm } from "@/components/tickets/resell-form";
import { getTicket } from "@/lib/api/tickets";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/constants/ticket-detail";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";

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
    <PageShell width="md">
      <BackLink href={`/billets/${id}`}>Retour au billet</BackLink>

      {ticket === undefined ? (
        <MutedMessage />
      ) : error ? (
        <Alert centered>
          {error}
        </Alert>
      ) : ticket === null ? (
        <div className={cardClass("p-8 text-center")}>
          <div className="mb-3 text-4xl">🎫</div>
          <h1 className="text-lg font-bold text-ink-1">Page introuvable</h1>
          <p className="mt-2 text-sm text-ink-5">
            Ce billet n&apos;existe pas, ou la page que vous cherchez a changé d&apos;adresse.
          </p>
        </div>
      ) : ticket.status === "valid" ? (
        <ResellForm ticket={ticket} />
      ) : (
        <p className={cardClass("px-5 py-8 text-center text-sm text-ink-5")}>
          {ticket.status === "for_resale"
            ? "Ce billet est déjà en cours de revente."
            : ticket.status === "used"
              ? "Ce billet a déjà été utilisé et ne peut pas être remis en revente."
              : "Ce billet a été annulé ou remboursé et ne peut pas être remis en revente."}
        </p>
      )}
    </PageShell>
  );
}
