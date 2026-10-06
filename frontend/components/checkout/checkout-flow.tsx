"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { BillingForm } from "@/components/checkout/billing-form";
import { ReservationTimer } from "@/components/checkout/reservation-timer";
import { StripePaymentForm } from "@/components/checkout/stripe-payment-form";
import { getCart, cartTotal, clearCart, type Cart } from "@/lib/checkout/cart";
import { createPaymentIntent } from "@/lib/api/payments";
import { cancelOrder } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { getStripe } from "@/lib/stripe/client";
import { euros as currency } from "@/lib/format/money";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

type Step = "billing" | "payment";

export function CheckoutFlow() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("billing");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  // Réservation expirée : le formulaire est remplacé plutôt que de laisser remplir une commande vouée à l'échec.
  const [reservationExpired, setReservationExpired] = useState(false);

  function handleReservationExpired() {
    clearCart();
    setReservationExpired(true);
    // Commande créée mais non payée : ses places sont remises en vente sans attendre le nettoyage automatique.
    if (orderId) {
      cancelOrder(orderId, "Délai de paiement dépassé").catch(() => undefined);
    }
  }

  useEffect(() => {
    // sessionStorage absent côté serveur : lu après montage pour éviter un hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(getCart());
  }, []);

  async function handleOrderCreated(newOrderId: string) {
    setOrderId(newOrderId);
    setIntentError(null);

    // Événement gratuit : commande confirmée à sa création, sans PaymentIntent.
    if (cart && cartTotal(cart) === 0) {
      clearCart();
      router.push(`/commande/confirmation?order_id=${newOrderId}`);
      return;
    }

    setIntentLoading(true);
    try {
      const intent = await createPaymentIntent(newOrderId);
      if (intent.client_secret) {
        setClientSecret(intent.client_secret);
        clearCart(); // le stock est maintenant garanti par la commande créée, plus par la réservation
        setStep("payment");
      } else {
        setIntentError(
          t("Ce moyen de paiement n'est pas encore disponible — seule la carte bancaire est câblée pour l'instant."),
        );
      }
    } catch (err) {
      setIntentError(
        err instanceof ApiError
          ? err.message
          : t("Impossible d'initialiser le paiement, veuillez réessayer."),
      );
    } finally {
      setIntentLoading(false);
    }
  }

  if (cart === undefined) {
    return <MutedMessage />;
  }

  if (reservationExpired && cart) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-hairline-2 bg-card p-8 text-center">
        <h2 className="text-lg font-bold text-ink-1">{t("Votre réservation a expiré")}</h2>
        <p className="mt-2 text-sm text-ink-4">{t("Les places sont bloquées pendant une durée limitée pour laisser leur chance aux autres acheteurs. Elles ont été remises en vente — vous pouvez les réserver à nouveau si elles sont encore disponibles.")}</p>
        <Link
          href={cart.eventPath ?? `/evenements/${cart.eventId}`}
          className="mt-5 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >{t("Réserver à nouveau")}</Link>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className={cardClass("mx-auto max-w-md p-8 text-center")}>
        <p className="text-sm text-ink-4">{t("Votre panier est vide ou votre réservation a expiré.")}</p>
        <Link
          href="/evenements"
          className={buttonClass("primary", "mt-4 inline-flex rounded-full px-5 py-2.5 text-sm")}
        >{t("Voir les événements")}</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CheckoutStepper current={step === "billing" ? "identification" : "paiement"} free={cartTotal(cart) === 0} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {/* Même échéance pour la réservation et la commande : un seul décompte jusqu'au paiement. */}
        <ReservationTimer expiresAt={cart.expiresAt} onExpire={handleReservationExpired} />

        {step === "billing" ? (
          <>
            <BillingForm
              cart={cart}
              onOrderCreated={handleOrderCreated}
              onReservationExpired={handleReservationExpired}
            />
          </>
        ) : null}

        {intentLoading ? (
          <MutedMessage>{t("Initialisation du paiement…")}</MutedMessage>
        ) : null}

        {intentError ? (
          <Alert>
            {intentError}
          </Alert>
        ) : null}

        {step === "payment" && clientSecret && orderId ? (
          <Elements
            stripe={getStripe()}
            options={{ clientSecret, locale: "fr" }}
          >
            <StripePaymentForm orderId={orderId} amountLabel={currency.format(cartTotal(cart))} />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}
