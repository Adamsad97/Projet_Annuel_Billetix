import { AuthHeader } from "@/components/layout/auth-header";
import { CreateEventForm } from "@/components/create-event/create-event-form";
import { listCategories } from "@/lib/api/categories";
import { listTicketTierTypes } from "@/lib/api/ticket-tier-types";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

// Rendu à chaque requête, sinon next build figerait une liste vide.
export const dynamic = "force-dynamic";

export default async function CreerEvenementPage() {
  const t = await getT();
  const [categories, tierTypes] = await Promise.all([
    listCategories().catch(() => []),
    listTicketTierTypes().catch(() => []),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <BackLink href="/dashboard">{t("Dashboard")}</BackLink>

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Créer un événement")}</h1>
          <p className="mt-1 text-sm text-accent">{t("Votre événement sera examiné et publié sous 48h ouvrées")}</p>
        </div>

        <CreateEventForm categories={categories} tierTypes={tierTypes} />
      </main>
    </div>
  );
}
