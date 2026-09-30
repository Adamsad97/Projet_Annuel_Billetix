import { PageShell } from "@/components/layout/page-shell";
import { OrdersExplorer } from "@/components/profile/orders-explorer";
import { BackLink } from "@/components/ui/back-link";

export default function MesCommandesPage() {
  return (
    <PageShell width="3xl">
      <BackLink href="/profil">Profil</BackLink>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Mes commandes</h1>
        <p className="mt-1 text-sm text-ink-5">
          Toutes les commandes passées avec votre compte.
        </p>
      </div>

      <OrdersExplorer />
    </PageShell>
  );
}
