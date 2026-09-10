"use client";

// Bug corrigé : page 100% maquette — ne reconnaissait que 2 références
// factices ("ORD-2026-00847", etc.), donc "Page introuvable" systématique
// pour toute vraie commande. Câblée sur order-service/ticket-service.
// Le segment de route s'appelle [reference] mais reçoit en réalité le vrai
// id (UUID) de la commande — order-service ne sait pas chercher par
// référence humaine, seulement par id (voir OrderRow: href utilise order.id).

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { getOrder, resendTickets, type ApiOrder, type ApiOrderItem } from "@/lib/api/orders";
import { getTicketsByOrder, type ApiTicket } from "@/lib/api/tickets";
import { orderStatusBadge } from "@/lib/mock/profile";
import { apiOrderItemsToLines, orderStatusFor, paymentMethodLabel } from "@/lib/mappers/profile-mappers";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference: orderId } = use(params);
  const [order, setOrder] = useState<ApiOrder | null | undefined>(undefined);
  const [items, setItems] = useState<ApiOrderItem[]>([]);
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Bug corrigé : juste après paiement, la commande passe CONFIRMED avant
    // que ticket-service ait fini de générer les billets (quasi simultané
    // mais pas atomique) — une seule lecture au mauvais moment affichait
    // "Aucun billet pour cette commande" de façon définitive, sans jamais se
    // corriger tant que la page n'était pas rechargée manuellement.
    async function loadTickets(status: string) {
      const shouldHaveTickets = status === "CONFIRMED" || status === "TICKETS_SENT";
      const maxAttempts = shouldHaveTickets ? 5 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const orderTickets = await getTicketsByOrder(orderId).catch(() => []);
        if (cancelled) return;
        if (orderTickets.length > 0 || attempt === maxAttempts) {
          setTickets(orderTickets);
          setTicketsLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    getOrder(orderId)
      .then((result) => {
        if (cancelled) return;
        setOrder(result.order);
        setItems(result.items);
        loadTickets(result.order.status);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setOrder(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger cette commande.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const badge = order ? orderStatusBadge[orderStatusFor(order.status)] : null;
  const lines = apiOrderItemsToLines(items);
  const canResend = order?.status === "CONFIRMED" || order?.status === "TICKETS_SENT";

  async function handleResend() {
    if (!order) return;
    setResendState("loading");
    setResendError(null);
    try {
      await resendTickets(order.id);
      setResendState("sent");
    } catch (err) {
      setResendState("error");
      setResendError(
        err instanceof ApiError ? err.message : "Impossible de renvoyer les billets, réessaie.",
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <Link
          href="/profil"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Profil
        </Link>

        {order === undefined ? (
          <p className="text-center text-sm text-gray-500">Chargement…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : order === null ? (
          <div className="rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
            <div className="mb-3 text-4xl">📦</div>
            <h1 className="text-lg font-bold text-white">Page introuvable</h1>
            <p className="mt-2 text-sm text-gray-500">
              Cette commande n&apos;existe pas, ou a changé d&apos;adresse.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">{order.reference}</h1>
                <p className="text-sm text-gray-500">
                  Passée le {dateFormatter.format(new Date(order.created_at))}
                </p>
              </div>
              {badge ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-200">Récapitulatif</h2>
              {lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-400">{line.label}</span>
                  <span className="text-gray-300">{currency.format(line.amount)}</span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="font-bold text-white">Total</span>
                <span className="font-bold text-white">
                  {currency.format(Number(order.total_amount_ttc))}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                💳 {paymentMethodLabel(order.payment_method)}
              </p>
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold text-gray-200">Billets inclus</h2>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
              {tickets.length === 0 && ticketsLoading ? (
                <p className="px-5 py-4 text-sm text-gray-500">Chargement des billets…</p>
              ) : tickets.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Aucun billet pour cette commande.</p>
              ) : (
                tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/billets/${ticket.id}`}
                    className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🎫</span>
                      <div>
                        <p className="text-sm font-bold text-white">{ticket.event_name}</p>
                        <p className="text-xs text-gray-500">{ticket.reference}</p>
                      </div>
                    </div>
                    <span className="text-sm text-violet-400">Voir →</span>
                  </Link>
                ))
              )}
            </div>

            {canResend ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === "loading" || resendState === "sent"}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendState === "loading"
                    ? "Envoi en cours…"
                    : resendState === "sent"
                      ? "✓ Billets renvoyés"
                      : "📧 Renvoyer les billets par email"}
                </button>
                {resendState === "error" ? (
                  <p className="text-xs text-red-300">{resendError}</p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
