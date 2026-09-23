"use client";

// Bug corrigé : affichait "Activé" en dur, sans jamais lire l'état réel de
// la 2FA (ni même la valeur mockée) — le statut ne reflétait donc jamais ce
// qui se passait sur /profil/securite/2fa.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/profile/panel";
import { ChangePasswordRow } from "@/components/profile/change-password-row";
import { get2faStatus } from "@/lib/api/two-factor";

export function SecurityPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    get2faStatus()
      .then((status) => {
        if (!cancelled) setEnabled(status);
      })
      .catch(() => {
        if (!cancelled) setEnabled(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel icon="🔒" title="Sécurité du compte" defaultExpanded>
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-white">Authentification 2FA</p>
          <p className="text-xs text-gray-500">Via application TOTP (Google Authenticator)</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enabled === null ? null : enabled ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              Activé
            </span>
          ) : (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10">
              Désactivé
            </span>
          )}
          <Link
            href="/profil/securite/2fa"
            className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
          >
            Gérer
          </Link>
        </div>
      </div>

      <ChangePasswordRow />
    </Panel>
  );
}
