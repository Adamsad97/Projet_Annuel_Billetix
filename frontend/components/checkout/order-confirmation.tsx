"use client";

// Rendu côté client : GET /orders/:id exige le jeton stocké dans le navigateur.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { getOrder, type ApiOrder, type ApiOrderItem } from "@/lib/api/orders";
import { syncOrderPayment } from "@/lib/api/payments";
import { ApiError } from "@/lib/api/http-error";
import { euros as currency } from "@/lib/format/money";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [items, setItems] = useState<ApiOrderItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // On réinterroge tant que la commande reste PENDING_PAYMENT (le webhook peut arriver après).
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
          // Sans webhook, le serveur vérifie lui-même auprès de Stripe (idempotent).
          await syncOrderPayment(orderId).catch(() => undefined);
          setTimeout(() => {
            if (!cancelled) load(attempt + 1);
          }, POLL_DELAY_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : t("Impossible de charger cette commande."),
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
        <CheckoutStepper current="confirmation" free={order ? Number(order.total_amount_ttc) === 0 : false} />
      </div>

      {loading ? (
        <MutedMessage>{t("Chargement de votre commande…")}</MutedMessage>
      ) : loadError || !order ? (
        <Alert centered className="mx-auto max-w-lg">
          {loadError}
        </Alert>
      ) : (
        <div className={cardClass("mx-auto flex max-w-lg flex-col items-center gap-5 p-8 text-center")}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
            ✓
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink-1">
              {order.status === "PENDING_PAYMENT"
                ? t("Commande créée")
                : Number(order.total_amount_ttc) === 0
                  ? t("Réservation confirmée !")
                  : t("Paiement confirmé !")}
            </h1>
            <p className="mt-1 text-sm text-ink-5">{t("Commande")}{" "}<span className="text-ink-1">{order.reference}</span>
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
              <span className="font-bold text-ink-1">{t("Total payé")}</span>
              <span className="font-bold text-ink-1">
                {Number(order.total_amount_ttc) === 0 ? t("Gratuit") : currency.format(Number(order.total_amount_ttc))}
              </span>
            </div>
          </div>

          <p className="text-sm text-accent">
            🎫 {t("Vos billets sont disponibles dans « Mes billets ».")}
            {Number(order.total_amount_ttc) > 0 ? t(" Votre facture vous est envoyée par email.") : ""}
          </p>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Link
              href="/profil/billets"
              className={buttonClass("primary", "flex-1 rounded-full py-3 text-sm")}
            >{t("Voir mes billets")}</Link>
            <Link
              href="/evenements"
              className={buttonClass("secondary", "flex-1 rounded-full py-3 text-sm")}
            >{t("Voir les événements")}</Link>
          </div>
        </div>
      )}
    </main>
  );
}
