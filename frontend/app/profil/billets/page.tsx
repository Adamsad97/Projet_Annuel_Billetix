import { PageShell } from "@/components/layout/page-shell";
import { TicketsExplorer } from "@/components/profile/tickets-explorer";
import { TwoFactorPromo } from "@/components/profile/two-factor-promo";
import { BackLink } from "@/components/ui/back-link";

export default function MesBilletsPage() {
  return (
    <PageShell width="3xl">
      <BackLink href="/profil">Profil</BackLink>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Mes billets</h1>
        <p className="mt-1 text-sm text-ink-5">
          Tous les billets liés à votre compte, valides ou déjà utilisés.
        </p>
      </div>

      <TwoFactorPromo className="mb-6" />
      <TicketsExplorer />
    </PageShell>
  );
}
