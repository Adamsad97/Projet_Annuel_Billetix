import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedLabel="1 juillet 2026">
      <LegalSection title="Données collectées">
        <p>
          Nous collectons les données nécessaires à la création de votre
          compte (nom, email), au traitement de vos commandes (adresse de
          facturation) et, pour les organisateurs, à la vérification
          d&apos;identité (KYC) requise pour recevoir des reversements.
        </p>
      </LegalSection>

      <LegalSection title="Utilisation des données">
        <p>
          Vos données servent à la gestion de votre compte, à
          l&apos;envoi de vos billets, aux notifications liées à vos
          commandes et, avec votre consentement, à des communications
          marketing.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits (RGPD)">
        <p>
          Conformément au Règlement Général sur la Protection des Données,
          vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement et de portabilité de vos données. Vous pouvez
          exercer ces droits depuis votre{" "}
          <a href="/profil" className="text-violet-400 hover:text-violet-300">
            profil
          </a>{" "}
          ou en nous contactant.
        </p>
      </LegalSection>

      <LegalSection title="Conservation">
        <p>
          Les données liées aux commandes sont conservées pendant la durée
          légale de conservation des documents comptables. Les comptes
          inactifs peuvent être supprimés après notification préalable.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les mots de passe sont hachés, les paiements sont traités par des
          prestataires certifiés PCI-DSS, et l&apos;authentification à deux
          facteurs (2FA) est disponible pour renforcer la sécurité de votre
          compte.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
