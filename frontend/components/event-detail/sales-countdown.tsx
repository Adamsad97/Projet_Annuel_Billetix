"use client";

// Bug corrigé (règle produit jamais appliquée) : sales_start_date/
// sales_end_date étaient stockées mais jamais vérifiées à l'achat — un
// événement validé restait achetable à n'importe quel moment (corrigé côté
// backend, ticket-category.service.ts decrementQuota()). Ce composant
// couvre le pendant frontend : tant que les ventes ne sont pas ouvertes, un
// compte à rebours (tableau d'affichage façon panneau de gare) remplace le
// formulaire d'achat, et bascule automatiquement dessus à zéro — sans
// recharger la page.

import { useEffect, useState } from "react";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Le tableau d'affichage seul (jours/heures/min/sec), sans la carte qui
 * l'entoure — réutilisé par TicketSelector, côté acheteur (remplace le
 * formulaire d'achat jusqu'à l'ouverture) comme pour l'organisateur/un
 * admin consultant sa propre fiche : ceux-ci voient déjà un message de
 * blocage dans leur propre carte, doubler la carte "Choisir mes billets"
 * par-dessus serait redondant — seul le compte à rebours en lui-même
 * s'insère chez eux, en lecture seule (`onZero` peut être un no-op).
 */
export function CountdownDigits({
  targetIso,
  onZero,
}: {
  targetIso: string;
  onZero: () => void;
}) {
  // null tant que non monté côté client — évite de calculer "maintenant"
  // pendant le rendu (hydratation), comme partout ailleurs dans l'app.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(targetIso).getTime();

    function tick() {
      const diff = target - Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemainingMs(diff);
      if (diff <= 0) onZero();
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  if (remainingMs === null || remainingMs <= 0) {
    return <p className="text-sm text-ink-5">Chargement…</p>;
  }

  const { days, hours, minutes, seconds } = splitRemaining(remainingMs);
  const units = [
    { label: "Jours", value: days },
    { label: "Heures", value: hours },
    { label: "Min", value: minutes },
    { label: "Sec", value: seconds },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex flex-col items-center rounded-xl border border-emerald-500/20 bg-black/40 py-3"
        >
          <span className="font-mono text-2xl font-bold tabular-nums text-emerald-400 [text-shadow:0_0_8px_rgba(16,185,129,0.6)]">
            {pad(unit.value)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-ink-5">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
