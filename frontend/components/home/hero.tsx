"use client";

import { t } from "@/lib/i18n/translate";
export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-10 pt-20 text-center">
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-accent ring-1 ring-inset ring-blue-500/30">{t("🎟️ Plateforme de billetterie sécurisée")}</span>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink-1 sm:text-5xl">{t("Votre prochain événement")}<br />
          <span className="text-blue-400">{t("commence ici")}</span>
        </h1>

        <p className="max-w-xl text-lg text-ink-4">{t("Concerts, festivals, spectacles près de chez vous. Paiement sécurisé.")}</p>
      </div>
    </section>
  );
}
