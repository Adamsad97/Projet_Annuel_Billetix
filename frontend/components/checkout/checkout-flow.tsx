"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { BillingForm } from "@/components/checkout/billing-form";
import { StripePaymentForm } from "@/components/checkout/stripe-payment-form";
import { getCart, cartTotal, clearCart, type Cart } from "@/lib/checkout/cart";
import { createPaymentIntent } from "@/lib/api/payments";
import { ApiError } from "@/lib/api/http-error";
import { getStripe } from "@/lib/stripe/client";
import { paymentMethods } from "@/lib/mock/checkout";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

type Step = "billing" | "payment";

export function CheckoutFlow() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("billing");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);

  useEffect(() => {
    // sessionStorage n'existe pas côté serveur — lu ici (après montage)
    // plutôt qu'en initialiseur de useState pour que le premier rendu
    // client corresponde au HTML serveur (évite un hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(getCart());
  }, []);

  async function handleOrderCreated(newOrderId: string) {
    setOrderId(newOrderId);
    setIntentError(null);

    // Bug corrigé : un événement gratuit n'a aucun paiement à collecter —
    // le backend confirme la commande et génère les billets immédiatement à
    // sa création (voir OrderController.create, total_amount_ttc === 0),
    // sans jamais passer par Stripe. Tenter quand même de créer un
    // PaymentIntent pour 0 € échouait, affichant le message trompeur "Ce
    // moyen de paiement n'est pas encore disponible" — impossible de
    // récupérer un billet gratuit.
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
          "Ce moyen de paiement n'est pas encore disponible — seule la carte bancaire est câblée pour l'instant.",
        );
      }
    } catch (err) {
      setIntentError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'initialiser le paiement, réessaie.",
      );
    } finally {
      setIntentLoading(false);
    }
  }

  if (cart === undefined) {
    return <p className="text-center text-sm text-gray-500">Chargement…</p>;
  }

  if (!cart) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <p className="text-sm text-gray-400">
          Ton panier est vide ou ta réservation a expiré.
        </p>
        <Link
          href="/catalogue"
          className="mt-4 inline-flex rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CheckoutStepper current={step === "billing" ? "identification" : "paiement"} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {step === "billing" ? (
          <BillingForm cart={cart} onOrderCreated={handleOrderCreated} />
        ) : null}

        {intentLoading ? (
          <p className="text-center text-sm text-gray-500">Initialisation du paiement…</p>
        ) : null}

        {intentError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {intentError}
          </div>
        ) : null}

        {step === "payment" && clientSecret && orderId ? (
          <>
            <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-200">Moyen de paiement</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {paymentMethods.map((method) => {
                  const isCard = method.id === "card";
                  return (
                    <div
                      key={method.id}
                      title={isCard ? undefined : "Pas encore câblé — carte bancaire uniquement pour l'instant"}
                      className={
                        isCard
                          ? "flex flex-col items-center gap-1.5 rounded-xl border border-violet-500 bg-violet-500/10 py-3"
                          : "flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] py-3 opacity-40"
                      }
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${method.glyphClassName}`}>
                        {method.glyph}
                      </span>
                      <span className="text-[11px] font-medium text-gray-300">{method.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Elements
              stripe={getStripe()}
              options={{ clientSecret, locale: "fr" }}
            >
              <StripePaymentForm orderId={orderId} amountLabel={currency.format(cartTotal(cart))} />
            </Elements>
          </>
        ) : null}
      </div>
    </div>
  );
}
