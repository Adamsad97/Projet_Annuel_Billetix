import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { CreateEventForm } from "@/components/create-event/create-event-form";
import { listCategories } from "@/lib/api/categories";
import { listTicketTierTypes } from "@/lib/api/ticket-tier-types";

// Bug corrigé : sans ça, `next build` fige cette page au moment du build,
// API injoignable → liste vide servie à tout le monde, indéfiniment.
// Invisible en `next dev`, qui rend chaque requête.
export const dynamic = "force-dynamic";

export default async function CreerEvenementPage() {
  const [categories, tierTypes] = await Promise.all([
    listCategories().catch(() => []),
    listTicketTierTypes().catch(() => []),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Dashboard
        </Link>

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-ink-1">Créer un événement</h1>
          <p className="mt-1 text-sm text-accent">
            Votre événement sera examiné et publié sous 48h ouvrées
          </p>
        </div>

        <CreateEventForm categories={categories} tierTypes={tierTypes} />
      </main>
    </div>
  );
}
