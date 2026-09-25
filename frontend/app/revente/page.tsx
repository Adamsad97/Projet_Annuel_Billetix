// Bug corrigé : page 100% maquette (annonces factices, bouton "Acheter"
// sans action) — câblée sur ticket-service (marketplace globale, toutes
// annonces LISTED confondues).

import { Navbar } from "@/components/layout/navbar";
import { BuyerOnlyGate } from "@/components/layout/buyer-only-gate";
import { ResaleCard } from "@/components/resale/resale-card";
import { listResaleListings } from "@/lib/api/resale";
import { resaleNote } from "@/lib/mock/resale";

export default async function RevendePage() {
  const listings = await listResaleListings().catch(() => []);

  return (
    <BuyerOnlyGate>
      <div className="flex flex-1 flex-col bg-[#07060c]">
        <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white">Revente de billets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Achetez des billets revendus par d&apos;autres utilisateurs, au prix d&apos;origine.
          </p>
        </div>

        <p className="mb-8 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/25">
          🛡️ {resaleNote}
        </p>

        {listings.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-10 text-center text-sm text-gray-500">
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
    </BuyerOnlyGate>
  );
}
