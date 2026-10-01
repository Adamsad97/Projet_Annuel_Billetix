"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className={cardClass("p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h2 className="text-lg font-bold text-ink-1">{t("Message envoyé")}</h2>
        <p className="mt-2 text-sm text-ink-5">{t("Notre équipe vous répond généralement sous 24h ouvrées.")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
      className={cardClass("flex flex-col gap-4 p-8")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Nom")}</span>
          <input
            type="text"
            required
            placeholder={t("Jean Dupont")}
            className={fieldClass("px-4 py-3")}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Email")}</span>
          <input
            type="email"
            required
            placeholder="jean.dupont@email.com"
            className={fieldClass("px-4 py-3")}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Sujet")}</span>
        <select className={fieldClass("px-4 py-3")}>
          <option>{t("Question sur une commande")}</option>
          <option>{t("Problème avec un billet")}</option>
          <option>{t("Devenir organisateur")}</option>
          <option>{t("Autre")}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-accent/80">{t("Message")}</span>
        <textarea
          required
          rows={5}
          placeholder={t("Expliquez-nous votre demande…")}
          className={fieldClass("resize-none px-4 py-3")}
        />
      </label>

      <button
        type="submit"
        className={buttonClass("primary", "mt-1 w-full rounded-full py-3 text-sm")}
      >{t("Envoyer le message →")}</button>
    </form>
  );
}
