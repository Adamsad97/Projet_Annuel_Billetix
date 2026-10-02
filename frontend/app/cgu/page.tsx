import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";

export default async function CguPage() {
  const t = await getT();
  return (
    <LegalPage title={t("Conditions générales d'utilisation")} updatedLabel={t("1 juillet 2026")}>
      <LegalSection title={t("1. Objet")}>
        <p>{t("Les présentes conditions régissent l'utilisation de la plateforme BilleTix, qui met en relation des organisateurs d'événements et des acheteurs de billets.")}</p>
      </LegalSection>

      <LegalSection title={t("2. Comptes utilisateurs")}>
        <p>{t("Deux profils sont disponibles : acheteur et organisateur. Un même compte peut cumuler les deux rôles. Toute création d'événement par un organisateur est soumise à validation par l'équipe BilleTix sous 48h ouvrées.")}</p>
      </LegalSection>

      <LegalSection title={t("3. Billets et paiement")}>
        <p>{t("Chaque billet acheté est associé à un QR code signé et à usage unique. Le paiement se fait par carte bancaire, via la plateforme de paiement sécurisée Stripe.")}</p>
      </LegalSection>

      <LegalSection title={t("4. Annulation et remboursement")}>
        <p>{t("Un acheteur peut annuler sa commande jusqu'à 24h avant l'événement, sauf mention contraire de l'organisateur. En cas d'annulation de l'événement par l'organisateur, les billets sont automatiquement remboursés.")}</p>
      </LegalSection>

      <LegalSection title={t("5. Revente")}>
        <p>{t("La revente de billets entre utilisateurs est autorisée exclusivement via la marketplace BilleTix, au prix facial d'origine. Toute revente à profit est interdite.")}</p>
      </LegalSection>

      <LegalSection title={t("6. Reversements aux organisateurs")}>
        <p>{t("Les fonds collectés sont reversés aux organisateurs après déduction de la commission de la plateforme, après la fin de l'événement.")}</p>
      </LegalSection>
    </LegalPage>
  );
}
