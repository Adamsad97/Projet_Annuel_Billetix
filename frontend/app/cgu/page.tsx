import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export default function CguPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedLabel="1 juillet 2026">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions régissent l&apos;utilisation de la
          plateforme BilletiX, qui met en relation des organisateurs
          d&apos;événements et des acheteurs de billets.
        </p>
      </LegalSection>

      <LegalSection title="2. Comptes utilisateurs">
        <p>
          Deux profils sont disponibles : acheteur et organisateur. Un même
          compte peut cumuler les deux rôles. Toute création d&apos;événement
          par un organisateur est soumise à validation par l&apos;équipe
          BilletiX sous 48h ouvrées.
        </p>
      </LegalSection>

      <LegalSection title="3. Billets et paiement">
        <p>
          Chaque billet acheté est associé à un QR code signé et à usage
          unique, envoyé par email dans les 5 minutes suivant le paiement.
          Les moyens de paiement acceptés sont la carte bancaire, PayPal,
          Apple Pay, Google Pay, Orange Money et Wave.
        </p>
      </LegalSection>

      <LegalSection title="4. Annulation et remboursement">
        <p>
          Un acheteur peut annuler sa commande jusqu&apos;à 24h avant
          l&apos;événement, sauf mention contraire de l&apos;organisateur. En
          cas d&apos;annulation de l&apos;événement par l&apos;organisateur,
          les billets sont automatiquement remboursés.
        </p>
      </LegalSection>

      <LegalSection title="5. Revente">
        <p>
          La revente de billets entre utilisateurs est autorisée
          exclusivement via la marketplace BilletiX, au prix facial
          d&apos;origine. Toute revente à profit est interdite.
        </p>
      </LegalSection>

      <LegalSection title="6. Reversements aux organisateurs">
        <p>
          Les fonds collectés sont reversés aux organisateurs après
          déduction de la commission de la plateforme, au plus tôt deux
          jours ouvrés (J+2) après la fin de l&apos;événement.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
