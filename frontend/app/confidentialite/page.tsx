import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";

export default async function ConfidentialitePage() {
  const t = await getT();
  return (
    <LegalPage title={t("Politique de confidentialité")} updatedLabel={t("1 juillet 2026")}>
      <LegalSection title={t("Données collectées")}>
        <p>{t("Nous collectons les données nécessaires à la création de votre compte (nom, email), au traitement de vos commandes (adresse de facturation) et, pour les organisateurs, à la vérification d'identité (KYC) requise pour recevoir des reversements.")}</p>
      </LegalSection>

      <LegalSection title={t("Utilisation des données")}>
        <p>{t("Vos données servent à la gestion de votre compte, à l'envoi de vos billets, aux notifications liées à vos commandes et, avec votre consentement, à des communications marketing.")}</p>
      </LegalSection>

      <LegalSection title={t("Vos droits (RGPD)")}>
        <p>{t("Conformément au Règlement Général sur la Protection des Données, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Vous pouvez exercer ces droits depuis votre")}{" "}
          <a href="/profil" className="text-link hover:text-link-hover">
            profil
          </a>{" "}{t("ou en nous contactant.")}</p>
      </LegalSection>

      <LegalSection title={t("Conservation")}>
        <p>{t("Les données liées aux commandes sont conservées pendant la durée légale de conservation des documents comptables. Les comptes inactifs peuvent être supprimés après notification préalable.")}</p>
      </LegalSection>

      <LegalSection title={t("Sécurité")}>
        <p>{t("Les mots de passe sont hachés, les paiements sont traités par des prestataires certifiés PCI-DSS, et l'authentification à deux facteurs (2FA) est disponible pour renforcer la sécurité de votre compte.")}</p>
      </LegalSection>
    </LegalPage>
  );
}
