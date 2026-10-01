import { PageShell } from "@/components/layout/page-shell";
import { KycSection } from "@/components/dashboard/kyc-section";
import { PayoutAccountSection } from "@/components/dashboard/payout-account-section";
import { StripeConnectSection } from "@/components/dashboard/stripe-connect-section";
import { BackLink } from "@/components/ui/back-link";
import { getT } from "@/lib/i18n/server";

export default async function OrganizerPaymentsOnboardingPage() {
  const t = await getT();
  return (
    <PageShell width="lg">
      <BackLink href="/dashboard">{t("Tableau de bord")}</BackLink>

      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-ink-1">{t("Configurer les paiements")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Deux étapes pour recevoir le produit de vos ventes : votre identité, puis votre IBAN.")}</p>
      </div>

      <div className="flex flex-col gap-6">
        <KycSection />
        <PayoutAccountSection />
        <StripeConnectSection />
      </div>
    </PageShell>
  );
}
