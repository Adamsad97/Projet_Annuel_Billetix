import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { CreateEventForm } from "@/components/create-event/create-event-form";
import { listCategories } from "@/lib/api/categories";
import { listTicketTierTypes } from "@/lib/api/ticket-tier-types";

export default async function CreerEvenementPage() {
  const [categories, tierTypes] = await Promise.all([
    listCategories().catch(() => []),
    listTicketTierTypes().catch(() => []),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Dashboard
        </Link>

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-white">Créer un événement</h1>
          <p className="mt-1 text-sm text-violet-300">
            Votre événement sera examiné et publié sous 48h ouvrées
          </p>
        </div>

        <CreateEventForm categories={categories} tierTypes={tierTypes} />
      </main>
    </div>
  );
}
