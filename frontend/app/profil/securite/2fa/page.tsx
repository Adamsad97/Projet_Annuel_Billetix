import { PageShell } from "@/components/layout/page-shell";
import { TwoFactorManager } from "@/components/profile/two-factor-manager";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

export default async function TwoFactorPage() {
  const t = await getT();
  return (
    <PageShell width="md">
      <BackLink href="/profil">{t("Profil")}</BackLink>

      <TwoFactorManager />
    </PageShell>
  );
}
