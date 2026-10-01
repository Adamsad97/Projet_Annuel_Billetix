"use client";

// Achat d'une annonce de revente, réservé aux acheteurs connectés.

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { ResaleCheckoutFlow } from "@/components/resale/resale-checkout-flow";
import { getResaleListing, type ApiResaleListing } from "@/lib/api/resale";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export default function ResaleCheckoutPage({
  params,
}: {
  params: Promise<{ resaleId: string }>;
}) {
  const { resaleId } = use(params);
  // undefined : chargement ; null : introuvable (ou erreur).
  const [listing, setListing] = useState<ApiResaleListing | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getResaleListing(resaleId)
      .then((data) => {
        if (!cancelled) setListing(data);
      })
      .catch(() => {
        if (!cancelled) setListing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resaleId]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/revente" />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto mb-6 w-full max-w-2xl">
          <Link
            href="/revente"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
          >{t("← Marketplace revente")}</Link>
        </div>

        {listing === undefined ? (
          <MutedMessage>{t("Chargement de l'annonce…")}</MutedMessage>
        ) : !listing ? (
          <div className={cardClass("mx-auto max-w-md p-8 text-center")}>
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-ink-1">{t("Annonce introuvable")}</h1>
            <p className="mt-2 text-sm text-ink-5">{t("Cette offre n'existe plus, ou vient d'être vendue.")}</p>
          </div>
        ) : listing.status !== "LISTED" ? (
          <div className={cardClass("mx-auto max-w-md p-8 text-center")}>
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-ink-1">{t("Cette annonce n'est plus disponible")}</h1>
            <p className="mt-2 text-sm text-ink-5">{t("Elle vient d'être vendue, ou est en cours d'achat par quelqu'un d'autre.")}</p>
          </div>
        ) : (
          <ResaleCheckoutFlow listing={listing} />
        )}
      </main>
    </div>
  );
}
