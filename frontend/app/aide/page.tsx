import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { SiteFooter } from "@/components/layout/site-footer";
import { FaqAccordion } from "@/components/help/faq-accordion";
import { faqCategories } from "@/lib/mock/faq";

export default function AidePage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Centre d&apos;aide</h1>
          <p className="mt-1 text-sm text-gray-500">
            Les réponses aux questions les plus fréquentes sur BilletiX.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {faqCategories.map((category) => (
            <FaqAccordion key={category.id} category={category} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Tu ne trouves pas ta réponse ?{" "}
          <Link href="/contact" className="font-medium text-violet-400 hover:text-violet-300">
            Contacte-nous
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
