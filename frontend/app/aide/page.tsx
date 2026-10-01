import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { FaqAccordion } from "@/components/help/faq-accordion";
import { faqCategories } from "@/lib/constants/faq";
import { getT } from "@/lib/i18n/server";

export default async function AidePage() {
  const t = await getT();
  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Centre d'aide")}</h1>
          <p className="mt-1 text-sm text-ink-5">{t("Les réponses aux questions les plus fréquentes sur BilleTix.")}</p>
        </div>

        <div className="flex flex-col gap-6">
          {faqCategories.map((category) => (
            <FaqAccordion key={category.id} category={category} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-ink-5">{t("Vous ne trouvez pas votre réponse ?")}{" "}
          <Link href="/contact" className="font-medium text-link hover:text-link-hover">{t("Contactez-nous")}</Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
