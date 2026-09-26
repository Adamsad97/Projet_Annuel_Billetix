"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { ResaleBillingForm } from "@/components/resale/resale-billing-form";
import { ResaleStripePaymentForm } from "@/components/resale/resale-stripe-payment-form";
import { getStripe } from "@/lib/stripe/client";
import { getStoredUser } from "@/lib/auth/session";
import type { ApiResaleListing } from "@/lib/api/resale";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

type Step = "billing" | "payment";

export function ResaleCheckoutFlow({ listing }: { listing: ApiResaleListing }) {
  const [step, setStep] = useState<Step>("billing");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // undefined tant que non lu (évite un aperçu incorrect du formulaire avant
  // de savoir si c'est bien la propre annonce de l'utilisateur connecté).
  const [isOwnListing, setIsOwnListing] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOwnListing(getStoredUser()?.id === listing.original_buyer_id);
  }, [listing.original_buyer_id]);

  function handleOrderCreated(newOrderId: string, secret: string) {
    setOrderId(newOrderId);
    setClientSecret(secret);
    setStep("payment");
  }

  if (isOwnListing === undefined) {
    return <p className="text-center text-sm text-ink-5">Chargement…</p>;
  }

  if (isOwnListing) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mb-3 text-4xl">🎫</div>
        <h1 className="text-lg font-bold text-ink-1">C&apos;est votre propre annonce</h1>
        <p className="mt-2 text-sm text-ink-5">
          Vous ne pouvez pas racheter un billet que vous avez vous-même mis en revente.
          Change d&apos;avis directement depuis le billet.
        </p>
        <Link
          href={`/billets/${listing.ticket_id}`}
          className="mt-4 inline-flex rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >
          Voir le billet →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {step === "billing" ? (
        <ResaleBillingForm listing={listing} onOrderCreated={handleOrderCreated} />
      ) : null}

      {step === "payment" && clientSecret && orderId ? (
        <Elements stripe={getStripe()} options={{ clientSecret, locale: "fr" }}>
          <ResaleStripePaymentForm
            resaleId={listing.id}
            orderId={orderId}
            amountLabel={currency.format(Number(listing.resale_price))}
          />
        </Elements>
      ) : null}
    </div>
  );
}
