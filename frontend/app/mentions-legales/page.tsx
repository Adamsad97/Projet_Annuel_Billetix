import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updatedLabel="1 juillet 2026">
      <LegalSection title="Éditeur du site">
        <p>
          BilletiX SAS, immatriculée sous le numéro SIRET 123 456 789 00012,
          dont le siège social est situé au 1 rue de la Billetterie, 75001
          Paris. Numéro de TVA intracommunautaire : FR12345678900.
        </p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>Le représentant légal de BilletiX SAS.</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site et les services associés sont hébergés sur une
          infrastructure cloud sécurisée au sein de l&apos;Union européenne.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus présents sur BilletiX (textes, logos,
          visuels, structure) est protégé par le droit d&apos;auteur. Toute
          reproduction sans autorisation est interdite.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative aux présentes mentions légales,
          contactez-nous via la page{" "}
          <a href="/contact" className="text-violet-400 hover:text-violet-300">
            Contact
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
