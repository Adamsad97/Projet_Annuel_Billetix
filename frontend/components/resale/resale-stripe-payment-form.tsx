"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export function ResaleStripePaymentForm({
  resaleId,
  orderId,
  amountLabel,
}: {
  resaleId: string;
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

    // La finalisation réelle (transfert du billet + remboursement du
    // vendeur) se fait sur la page de confirmation, pas ici — c'est le seul
    // endroit qui marche à la fois pour un paiement immédiat (if_required)
    // et pour un paiement nécessitant une redirection complète (3DS).
    const confirmationUrl = `${window.location.origin}/revente/${resaleId}/confirmation?order_id=${orderId}`;

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: confirmationUrl },
    });

    if (submitError) {
      setError(submitError.message ?? "Le paiement a échoué, veuillez réessayer.");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      router.push(confirmationUrl.replace(window.location.origin, ""));
      return;
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-hairline-1 bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-2">
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
        className="mt-6 w-full rounded-full bg-blue-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Traitement…" : `Payer ${amountLabel} →`}
      </button>

      <p className="mt-3 text-center text-xs text-ink-5">
        🔒 Paiement sécurisé — Stripe TLS 1.3 — Conforme PCI-DSS
      </p>
    </form>
  );
}
