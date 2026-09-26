"use client";

// Mise en avant de la double authentification (2FA) auprès des acheteurs :
// avec leurs billets, leur compte a désormais de la valeur — un mot de
// passe volé ne doit pas suffire pour entrer à leur place. Affiché
// uniquement si la 2FA n'est pas activée ; « Plus tard » masque le bandeau
// pour la durée de l'onglet.

import Link from "next/link";
import { useEffect, useState } from "react";
import { get2faStatus } from "@/lib/api/two-factor";

const DISMISS_KEY = "billetix_2fa_promo_dismissed";

export function TwoFactorPromo({ className = "" }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Stockage indisponible : on affiche quand même.
    }
    get2faStatus()
      .then((enabled) => {
        if (!cancelled && !enabled) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Sécuriser mon compte"
      className={`flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 sm:flex-row sm:items-center ${className}`}
    >
      <div className="flex flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-1">Protégez vos billets avec la double authentification</p>
          <p className="mt-0.5 text-sm text-ink-4">
            Un code de votre téléphone sera demandé à la connexion : même avec votre mot de passe,
            personne ne pourra accéder à vos billets.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Ignoré : le bandeau réapparaîtra simplement au prochain chargement.
            }
            setVisible(false);
          }}
          className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Plus tard
        </button>
        <Link
          href="/profil/securite/2fa"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Activer maintenant
        </Link>
      </div>
    </div>
  );
}
