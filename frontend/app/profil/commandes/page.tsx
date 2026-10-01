import { PageShell } from "@/components/layout/page-shell";
import { OrdersExplorer } from "@/components/profile/orders-explorer";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

export default async function MesCommandesPage() {
  const t = await getT();
  return (
    <PageShell width="3xl">
      <BackLink href="/profil">{t("Profil")}</BackLink>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Mes commandes")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Toutes les commandes passées avec votre compte.")}</p>
      </div>

      <OrdersExplorer />
    </PageShell>
  );
}
