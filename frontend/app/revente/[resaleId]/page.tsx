"use client";

// Achat d'une annonce de revente — réservé aux acheteurs connectés :
// annonce chargée avec la session, côté client (l'API refuse la lecture
// anonyme, app/revente/layout.tsx protège la section).

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { ResaleCheckoutFlow } from "@/components/resale/resale-checkout-flow";
import { getResaleListing, type ApiResaleListing } from "@/lib/api/resale";

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
          >
            ← Marketplace revente
          </Link>
        </div>

        {listing === undefined ? (
          <p className="text-center text-sm text-ink-5">Chargement de l&apos;annonce…</p>
        ) : !listing ? (
          <div className="mx-auto max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-ink-1">Annonce introuvable</h1>
            <p className="mt-2 text-sm text-ink-5">
              Cette offre n&apos;existe plus, ou vient d&apos;être vendue.
            </p>
          </div>
        ) : listing.status !== "LISTED" ? (
          <div className="mx-auto max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-ink-1">Cette annonce n&apos;est plus disponible</h1>
            <p className="mt-2 text-sm text-ink-5">
              Elle vient d&apos;être vendue, ou est en cours d&apos;achat par quelqu&apos;un d&apos;autre.
            </p>
          </div>
        ) : (
          <ResaleCheckoutFlow listing={listing} />
        )}
      </main>
    </div>
  );
}
