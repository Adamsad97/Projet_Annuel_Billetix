"use client";

import { useEffect, useRef, useState } from "react";
import { activeLocale, t } from "@/lib/i18n/translate";

// Sous ce seuil, le décompte passe en orange (réglage d'affichage).
const WARNING_SECONDS = 60;

function remainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/** « 01 minute », « 16 secondes » : pluriel à partir de 2 en français, dès que ≠ 1 en anglais. */
function unit(value: number, singular: string, plural: string): string {
  const isPlural = activeLocale() === "fr" ? value >= 2 : value !== 1;
  return t(isPlural ? plural : singular, { n: String(value).padStart(2, "0") });
}

/** Décompte visible de la réservation jusqu'au paiement, bascule automatique à zéro (onExpire). */
export function ReservationTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  // Dernier rappel reçu : la commande peut être créée pendant le décompte.
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    function tick() {
      const left = remainingSeconds(expiresAt);
      setSeconds(left);
      if (left === 0) {
        window.clearInterval(interval);
        onExpireRef.current();
      }
    }
    const interval = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (seconds === null) return null;

  const warning = seconds <= WARNING_SECONDS;
  const minutes = unit(Math.floor(seconds / 60), "{n} minute", "{n} minutes");
  const secs = unit(seconds % 60, "{n} seconde", "{n} secondes");

  return (
    <div
      role="timer"
      aria-live={warning ? "assertive" : "off"}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-3 text-sm ring-1 ring-inset sm:flex-row sm:gap-2 ${
        warning ? "bg-warning/10 text-warning ring-warning/30" : "bg-hairline-1 text-ink-3 ring-hairline-2"
      }`}
    >
      <span className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={warning ? "animate-pulse" : undefined}
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" />
        </svg>
        <span>
          {t("Temps restant :")}{" "}
          <strong className="font-semibold tabular-nums">
            {minutes} {secs}
          </strong>
        </span>
      </span>
      {warning ? <span className="text-xs sm:text-sm">{t("Terminez vite votre commande !")}</span> : null}
    </div>
  );
}
