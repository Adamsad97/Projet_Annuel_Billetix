import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar />

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <span className="text-6xl">🎫</span>
        <h1 className="text-3xl font-extrabold text-ink-1">{t("Page introuvable")}</h1>
        <p className="max-w-sm text-sm text-ink-5">{t("Cette page n'existe pas, ou a changé d'adresse.")}</p>
        <Link
          href="/"
          className={buttonClass("primary", "mt-2 rounded-full px-6 py-3 text-sm")}
        >{t("Retour à l'accueil")}</Link>
      </main>
    </div>
  );
}
