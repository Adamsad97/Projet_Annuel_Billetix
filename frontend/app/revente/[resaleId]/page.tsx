import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { ResaleCheckoutFlow } from "@/components/resale/resale-checkout-flow";
import { getResaleListing } from "@/lib/api/resale";
import { ApiError } from "@/lib/api/http-error";

export default async function ResaleCheckoutPage({
  params,
}: {
  params: Promise<{ resaleId: string }>;
}) {
  const { resaleId } = await params;
  const listing = await getResaleListing(resaleId).catch((err) =>
    err instanceof ApiError ? null : Promise.reject(err),
  );

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar active="/catalogue" />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto mb-6 w-full max-w-2xl">
          <Link
            href="/revente"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            ← Marketplace revente
          </Link>
        </div>

        {!listing ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-white">Annonce introuvable</h1>
            <p className="mt-2 text-sm text-gray-500">
              Cette offre n&apos;existe plus, ou vient d&apos;être vendue.
            </p>
          </div>
        ) : listing.status !== "LISTED" ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
            <div className="mb-3 text-4xl">🎫</div>
            <h1 className="text-lg font-bold text-white">Cette annonce n&apos;est plus disponible</h1>
            <p className="mt-2 text-sm text-gray-500">
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
