import { Navbar } from "@/components/layout/navbar";
import { ContactForm } from "@/components/contact/contact-form";
import { getT } from "@/lib/i18n/server";

export default async function ContactPage() {
  const t = await getT();
  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Nous contacter")}</h1>
          <p className="mt-1 text-sm text-ink-5">{t("Une question, un souci avec un billet ? Écrivez-nous.")}</p>
        </div>

        <ContactForm />
      </main>
    </div>
  );
}
