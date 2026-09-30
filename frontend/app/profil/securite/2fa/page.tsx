import { PageShell } from "@/components/layout/page-shell";
import { TwoFactorManager } from "@/components/profile/two-factor-manager";
import { BackLink } from "@/components/ui/back-link";

export default function TwoFactorPage() {
  return (
    <PageShell width="md">
      <BackLink href="/profil">Profil</BackLink>

      <TwoFactorManager />
    </PageShell>
  );
}
