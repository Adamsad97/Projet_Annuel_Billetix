"use client";

// Bug corrigé : page 100% maquette — ne reconnaissait que 5 identifiants
// factices ("nuit-electronique-standard", etc.), donc "Page introuvable"
// systématique pour tout vrai billet. Câblée sur ticket-service.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { TicketVisual } from "@/components/tickets/ticket-visual";
import { ResaleManagePanel } from "@/components/tickets/resale-manage-panel";
import { getTicket } from "@/lib/api/tickets";
import { downloadInvoice, getOrder } from "@/lib/api/orders";
import { apiTicketToDetail } from "@/lib/mappers/profile-mappers";
import type { TicketDetail } from "@/lib/constants/ticket-detail";
import { ApiError } from "@/lib/api/http-error";
import { TwoFactorPromo } from "@/components/profile/two-factor-promo";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
    <PageShell width="md">
      <BackLink href="/profil/billets">Mes billets</BackLink>

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
      ) : (
        <>
          <TwoFactorPromo className="mb-6" />
          {ticket.receivedFrom ? (
            <p className="mb-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink-2">
              🎁 Billet offert par <strong>{ticket.receivedFrom.name}</strong> ({ticket.receivedFrom.email}) le{" "}
              {ticket.receivedFrom.dateLabel}.
            </p>
          ) : null}
          {ticket.resalePurchase ? (
            <p className="mb-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink-2">
              🔄 Billet acheté en revente le {ticket.resalePurchase.dateLabel} pour {ticket.resalePurchase.priceLabel}.
            </p>
          ) : null}
          <TicketVisual ticket={ticket} />

          <div className="mt-6 flex flex-col gap-3">
            {/* Plus de billet PDF (le billet n'existe que dans l'application,
                QR éphémère) : la facture de la commande sert de preuve
                d'achat. Billet reçu en cadeau : la facture appartient à
                l'acheteur d'origine (ses coordonnées de facturation). */}
            {ticket.unitPriceTtc === 0 ? null : ticket.receivedFrom ? (
              <p className="rounded-xl bg-hairline-1 px-4 py-3 text-center text-sm text-ink-4">
                Billet reçu en cadeau : la facture reste celle de la personne qui l&apos;a acheté.
              </p>
            ) : (
              <button
                type="button"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  setDownloadError(null);
                  try {
                    const { order } = await getOrder(ticket.orderId);
                    await downloadInvoice(order.id, order.reference);
                  } catch (err) {
                    setDownloadError(err instanceof ApiError ? err.message : "Téléchargement impossible, veuillez réessayer.");
                  } finally {
                    setDownloading(false);
                  }
                }}
                className={buttonClass("secondary", "w-full rounded-full py-3 text-center text-sm disabled:opacity-60")}
              >
                {downloading ? "Téléchargement…" : "⬇️ Télécharger la facture"}
              </button>
            )}
            {downloadError ? (
              <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-center text-sm text-danger ring-1 ring-inset ring-danger/30">
                {downloadError}
              </p>
            ) : null}

            {ticket.status === "valid" ? (
              <>
                <Link
                  href={`/billets/${id}/offrir`}
                  className="w-full rounded-full bg-hairline-1 py-3 text-center text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
                >
                  🎁 Offrir ce billet
                </Link>
                <Link
                  href={`/billets/${id}/revendre`}
                  className="w-full rounded-full bg-hairline-1 py-3 text-center text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
                >
                  🔄 Revendre ce billet
                </Link>
              </>
            ) : ticket.status === "for_resale" ? (
              <ResaleManagePanel ticketId={id} onWithdrawn={reloadTicket} />
            ) : null}

            {/* Billet reçu : la commande d'origine appartient à l'expéditeur. */}
            {ticket.receivedFrom ? null : (
              <Link
                href={`/profil/commandes/${ticket.orderId}`}
                className="w-full rounded-full py-3 text-center text-sm font-medium text-ink-4 transition-colors hover:text-ink-2"
              >
                📦 Voir la commande associée
              </Link>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
