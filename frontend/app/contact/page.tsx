import { Navbar } from "@/components/layout/navbar";
import { ContactForm } from "@/components/contact/contact-form";

export default function ContactPage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-ink-1">Nous contacter</h1>
          <p className="mt-1 text-sm text-ink-5">
            Une question, un souci avec un billet ? Écrivez-nous.
          </p>
        </div>

        <ContactForm />
      </main>
    </div>
  );
}
