import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";

export default async function MentionsLegalesPage() {
  const t = await getT();
  return (
    <LegalPage title={t("Mentions légales")} updatedLabel={t("1 juillet 2026")}>
      <LegalSection title={t("Hébergement")}>
        <p>{t("Le site et les services associés sont hébergés sur une infrastructure cloud sécurisée au sein de l'Union européenne.")}</p>
      </LegalSection>

      <LegalSection title={t("Propriété intellectuelle")}>
        <p>{t("L'ensemble des contenus présents sur BilleTix (textes, logos, visuels, structure) est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.")}</p>
      </LegalSection>

      <LegalSection title={t("Contact")}>
        <p>{t("Pour toute question relative aux présentes mentions légales, contactez-nous via la page")}{" "}
          <a href="/contact" className="text-link hover:text-link-hover">{t("Contact")}</a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
