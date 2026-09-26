import { Navbar } from "@/components/layout/navbar";
import { BuyerOnlyGate } from "@/components/layout/buyer-only-gate";
import { CatalogueExplorer } from "@/components/catalogue/catalogue-explorer";
import { SiteFooter } from "@/components/layout/site-footer";

export default function CataloguePage() {
  return (
    <BuyerOnlyGate>
      <div className="flex flex-1 flex-col bg-page">
        <Navbar active="/catalogue" />

        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink-1">Catalogue</h1>
            <p className="mt-1 text-sm text-ink-5">
              Tous les événements disponibles sur BilletiX.
            </p>
          </div>

          <CatalogueExplorer />
        </main>

        <SiteFooter />
      </div>
    </BuyerOnlyGate>
  );
}
