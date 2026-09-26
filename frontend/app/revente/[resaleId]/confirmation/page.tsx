"use client";

// Rendu côté client : finalise réellement l'achat (transfert du billet +
// remboursement du vendeur, cf. POST /tickets/resale/:id/complete) — c'est
// le seul endroit qui fonctionne à la fois pour un paiement confirmé sans
// redirection et pour un paiement 3DS qui redirige complètement le
// navigateur ici après coup.

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { completeResale } from "@/lib/api/resale";
import { ApiError } from "@/lib/api/http-error";

export default function ResaleConfirmationPage({
  params,
}: {
  params: Promise<{ resaleId: string }>;
}) {
  const { resaleId } = use(params);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!orderId) {
      setStatus("error");
      setError("Commande introuvable.");
      return;
    }

    completeResale(resaleId, orderId)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Impossible de finaliser l'achat.");
      });
  }, [resaleId, orderId]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/catalogue" />

      <main className="flex-1 px-6 py-10">
        {status === "loading" ? (
          <p className="text-center text-sm text-ink-5">Finalisation de votre achat…</p>
        ) : status === "error" ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-hairline-1 bg-card p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-1">Achat confirmé !</h1>
              <p className="mt-1 text-sm text-ink-5">Le billet vous a été transféré.</p>
            </div>
            <p className="text-sm text-accent">
              🎫 Votre billet est disponible dans « Mes billets ». Votre facture vous est envoyée par email.
            </p>
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href="/profil/billets"
                className="flex-1 rounded-full bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
              >
                Voir mes billets
              </Link>
              <Link
                href="/revente"
                className="flex-1 rounded-full border border-hairline-3 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >
                Retour à la marketplace
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
