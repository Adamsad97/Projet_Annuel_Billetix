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
      <div className="flex items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-ink-1">Authentification 2FA</p>
          <p className="text-xs text-ink-5">Via application TOTP (Google Authenticator)</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enabled === null ? null : enabled ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              Activé
            </span>
          ) : (
            <span className="rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">
              Désactivé
            </span>
          )}
          <Link
            href="/profil/securite/2fa"
            className="rounded-full border border-hairline-3 px-3.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
          >
            Gérer
          </Link>
        </div>
      </div>

      <ChangePasswordRow />
    </Panel>
  );
}
