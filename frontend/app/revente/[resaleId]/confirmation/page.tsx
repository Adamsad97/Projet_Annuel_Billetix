"use client";

// Finalise l'achat en revente (transfert et remboursement du vendeur), avec ou sans redirection 3DS.

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { completeResale } from "@/lib/api/resale";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export default function ResaleConfirmationPage({
  params,
}: {
  params: Promise<{ resaleId: string }>;
}) {
  const { resaleId } = use(params);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [requestStatus, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [requestError, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  // Lien sans commande : erreur lue directement dans l'adresse, sans appel.
  const status = orderId ? requestStatus : "error";
  const error = orderId ? requestError : "Commande introuvable.";

  useEffect(() => {
    if (!orderId || attempted.current) return;
    attempted.current = true;

    completeResale(resaleId, orderId)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : t("Impossible de finaliser l'achat."));
      });
  }, [resaleId, orderId]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/evenements" />

      <main className="flex-1 px-6 py-10">
        {status === "loading" ? (
          <MutedMessage>{t("Finalisation de votre achat…")}</MutedMessage>
        ) : status === "error" ? (
          <Alert centered className="mx-auto max-w-lg">
            {error}
          </Alert>
        ) : (
          <div className={cardClass("mx-auto flex max-w-lg flex-col items-center gap-5 p-8 text-center")}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink-1">{t("Achat confirmé !")}</h1>
              <p className="mt-1 text-sm text-ink-5">{t("Le billet vous a été transféré.")}</p>
            </div>
            <p className="text-sm text-accent">{t("🎫 Votre billet est disponible dans « Mes billets ». Votre facture vous est envoyée par email.")}</p>
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href="/profil/billets"
                className={buttonClass("primary", "flex-1 rounded-full py-3 text-sm")}
              >{t("Voir mes billets")}</Link>
              <Link
                href="/revente"
                className={buttonClass("secondary", "flex-1 rounded-full py-3 text-sm")}
              >{t("Retour à la marketplace")}</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
