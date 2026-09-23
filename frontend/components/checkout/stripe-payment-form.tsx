"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export function StripePaymentForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      // if_required : reste sur place pour une carte simple (pas de 3DS) —
      // ne redirige que si le moyen de paiement l'exige vraiment.
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/commande/confirmation?order_id=${orderId}`,
      },
    });

    if (submitError) {
      setError(submitError.message ?? "Le paiement a échoué, réessaie.");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      router.push(`/commande/confirmation?order_id=${orderId}`);
      return;
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-200">
        <span>💳</span>
        Paiement par carte
      </h2>

      <PaymentElement options={{ layout: "tabs" }} />

      {error ? (
        <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="mt-6 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Traitement…" : `Payer ${amountLabel} →`}
      </button>

      <p className="mt-3 text-center text-xs text-gray-500">
        🔒 Paiement sécurisé — Stripe TLS 1.3 — Conforme PCI-DSS
      </p>
    </form>
  );
}
