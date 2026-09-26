"use client";

// Rendu côté client : la page de confirmation doit appeler GET /orders/:id,
// une route protégée par JWT — le token vit dans le localStorage/sessionStorage
// du navigateur, donc cet appel ne peut pas se faire depuis un composant
// serveur (qui n'a pas accès à ce stockage et se verrait toujours répondre
// "Token manquant").

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { getOrder, type ApiOrder, type ApiOrderItem } from "@/lib/api/orders";
import { syncOrderPayment } from "@/lib/api/payments";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [items, setItems] = useState<ApiOrderItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Bug corrigé : cette page pouvait s'afficher une fraction de seconde
    // avant que le webhook Stripe ait fini de confirmer le paiement côté
    // serveur (course), figeant "Commande créée" indéfiniment même une fois
    // le paiement réellement confirmé quelques secondes plus tard. On
    // réinterroge quelques fois tant que la commande reste PENDING_PAYMENT.
    const MAX_ATTEMPTS = 6;
    const POLL_DELAY_MS = 2000;

    async function load(attempt: number) {
      try {
        const result = await getOrder(orderId);
        if (cancelled) return;
        setOrder(result.order);
        setItems(result.items);
        setLoading(false);

        if (result.order.status === "PENDING_PAYMENT" && attempt < MAX_ATTEMPTS) {
          // Bug corrigé : on attendait uniquement le webhook Stripe — s'il
          // n'arrive jamais (serveur injoignable par Stripe…), la commande
          // restait en attente malgré un paiement encaissé. On demande au
          // serveur de vérifier lui-même auprès de Stripe (idempotent).
          await syncOrderPayment(orderId).catch(() => undefined);
          setTimeout(() => {
            if (!cancelled) load(attempt + 1);
          }, POLL_DELAY_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Impossible de charger cette commande.",
        );
        setLoading(false);
      }
    }

    load(0);
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <main className="flex-1 px-6 py-10">
      <div className="mb-10">
        <CheckoutStepper current="confirmation" />
      </div>

      {loading ? (
        <p className="text-center text-sm text-ink-5">Chargement de votre commande…</p>
      ) : loadError || !order ? (
        <p className="mx-auto max-w-lg rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
          {loadError}
        </p>
      ) : (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-hairline-1 bg-card p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
            ✓
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink-1">
              {order.status === "PENDING_PAYMENT" ? "Commande créée" : "Paiement confirmé !"}
            </h1>
            <p className="mt-1 text-sm text-ink-5">
              Commande <span className="text-ink-1">{order.reference}</span>
            </p>
          </div>

          <div className="w-full rounded-xl border border-hairline-2 bg-hairline-1 p-4 text-left">
            {items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-4">
                  {item.quantity}× {item.ticket_category_name}
                </span>
                <span className="text-ink-3">
                  {currency.format(Number(item.total_price_ttc))}
                </span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-hairline-2 pt-3">
              <span className="font-bold text-ink-1">Total payé</span>
              <span className="font-bold text-ink-1">
                {currency.format(Number(order.total_amount_ttc))}
              </span>
            </div>
          </div>

          <p className="text-sm text-accent">
            🎫 Vos billets sont disponibles dans « Mes billets ». Votre facture vous est envoyée par email.
          </p>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Link
              href="/profil/billets"
              className="flex-1 rounded-full bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
            >
              Voir mes billets
            </Link>
            <Link
              href="/catalogue"
              className="flex-1 rounded-full border border-hairline-3 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Retour au catalogue
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
