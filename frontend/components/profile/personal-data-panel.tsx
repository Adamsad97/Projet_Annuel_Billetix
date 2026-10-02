"use client";

// Droit d'accès et à la portabilité (RGPD) : téléchargement de toutes les données du compte.

import { useState } from "react";
import { Panel } from "@/components/profile/panel";
import { downloadMyPersonalData } from "@/lib/api/personal-data";
import { ApiError } from "@/lib/api/http-error";
import { reauthUrl } from "@/lib/auth/post-login";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n/translate";

export function PersonalDataPanel() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setStatus("loading");
    try {
      await downloadMyPersonalData();
      setStatus("done");
    } catch (err) {
      // Fichier sensible : le serveur exige une connexion récente, puis retour sur le profil.
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        window.location.assign(reauthUrl("/profil"));
        return;
      }
      setError(err instanceof ApiError ? err.message : t("Téléchargement impossible, veuillez réessayer."));
      setStatus("idle");
    }
  }

  return (
    <Panel icon="📄" title={t("Mes données personnelles")}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-1">{t("Télécharger mes données")}</p>
          <p className="text-xs text-ink-5">{t("Compte, commandes, billets, transferts et reventes, dans un fichier JSON réutilisable (RGPD).")}</p>
          {status === "done" ? (
            <p role="status" className="mt-1 text-xs text-emerald-400">{t("✓ Fichier téléchargé.")}</p>
          ) : null}
          {error ? <p role="alert" className="mt-1 text-xs text-red-400">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={status === "loading"}
          className={buttonClass("secondary", "shrink-0 rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {status === "loading" ? t("Préparation…") : t("Télécharger")}
        </button>
      </div>
    </Panel>
  );
}
