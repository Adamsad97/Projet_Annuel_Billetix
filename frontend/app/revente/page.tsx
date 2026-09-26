"use client";

// Marketplace de revente (ticket-service, toutes annonces LISTED
// confondues). Réservée aux acheteurs connectés (demande produit) : annonces
// chargées avec la session, côté client — l'API refuse la lecture anonyme,
// et app/revente/layout.tsx protège la section.

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { ResaleCard } from "@/components/resale/resale-card";
import { listResaleListings, type ApiResaleListing } from "@/lib/api/resale";
import { ApiError } from "@/lib/api/http-error";
import { resaleNote } from "@/lib/mock/resale";

export default function RevendePage() {
  const [listings, setListings] = useState<ApiResaleListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listResaleListings()
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Impossible de charger les annonces.");
        setListings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/revente" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-ink-1">Revente de billets</h1>
          <p className="mt-1 text-sm text-ink-5">
            Achetez des billets revendus par d&apos;autres utilisateurs, au prix d&apos;origine.
          </p>
        </div>

        <p className="mb-8 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/25">
          🛡️ {resaleNote}
        </p>

        {error ? (
          <p className="mb-6 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-inset ring-danger/30">
            {error}
          </p>
        ) : null}

        {listings === null ? (
          <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-10 text-center text-sm text-ink-5">
            Chargement des annonces…
          </p>
        ) : listings.length === 0 ? (
          <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-10 text-center text-sm text-ink-5">
            Aucun billet en revente pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ResaleCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
