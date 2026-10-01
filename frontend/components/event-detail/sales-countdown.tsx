"use client";

// Avant l'ouverture des ventes, un compte à rebours remplace le formulaire d'achat et bascule à zéro.

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

const VARIANTS = {
  // Carte « Choisir mes billets » : couleurs du thème (clair ou sombre).
  card: {
    box: "bg-hairline-1 ring-hairline-2",
    digit: "text-ink-1",
    label: "text-ink-5",
    separator: "text-ink-6",
  },
  // En-tête sur l'image de l'événement : verre dépoli, texte blanc.
  hero: {
    box: "bg-white/10 ring-white/20 backdrop-blur-md",
    digit: "text-white",
    label: "text-white/60",
    separator: "text-white/30",
  },
} as const;

/** Compte à rebours compact (jours masqués à zéro, place des chiffres réservée), réutilisé par la billetterie et l'en-tête. */
export function CountdownDigits({
  targetIso,
  onZero,
  variant = "card",
}: {
  targetIso: string;
  onZero: () => void;
  variant?: keyof typeof VARIANTS;
}) {
  // null tant que non monté côté client — évite de calculer "maintenant"
  // pendant le rendu (hydratation), comme partout ailleurs dans l'app.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(targetIso).getTime();

    function tick() {
      const diff = target - Date.now();
      setRemainingMs(diff);
      if (diff <= 0) onZero();
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  const style = VARIANTS[variant];
  const ready = remainingMs !== null && remainingMs > 0;
  const { days, hours, minutes, seconds } = splitRemaining(ready ? remainingMs : 0);
  const units = [
    ...(days > 0 || !ready ? [{ label: days > 1 ? "jours" : "jour", value: days }] : []),
    { label: "heures", value: hours },
    { label: "min", value: minutes },
    { label: "s", value: seconds },
  ];

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={ready ? `${days} jours ${hours} heures ${minutes} minutes ${seconds} secondes` : "Chargement du compte à rebours"}
      className={`inline-flex items-start rounded-2xl px-4 py-2.5 ring-1 ring-inset ${style.box}`}
    >
      {units.map((unit, index) => (
        <div key={unit.label} className="flex items-start">
          {index > 0 ? (
            <span aria-hidden="true" className={`px-1.5 text-xl font-light leading-8 ${style.separator}`}>
              :
            </span>
          ) : null}
          <div className="flex min-w-[2.6rem] flex-col items-center">
            <span className={`text-2xl font-semibold leading-8 tabular-nums tracking-tight ${style.digit}`}>
              {ready ? pad(unit.value) : "--"}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${style.label}`}>{unit.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Point qui pulse : information en direct (compte à rebours en cours). */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
    </span>
  );
}
