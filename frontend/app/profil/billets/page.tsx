import { PageShell } from "@/components/layout/page-shell";
import { TicketsExplorer } from "@/components/profile/tickets-explorer";
import { TwoFactorPromo } from "@/components/profile/two-factor-promo";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

export default async function MesBilletsPage() {
  const t = await getT();
  return (
    <PageShell width="3xl">
      <BackLink href="/profil">{t("Profil")}</BackLink>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Mes billets")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Tous les billets liés à votre compte, valides ou déjà utilisés.")}</p>
      </div>

      <TwoFactorPromo className="mb-6" />
      <TicketsExplorer />
    </PageShell>
  );
}
