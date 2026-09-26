"use client";

import { useEffect, useState } from "react";

// Sous ce seuil, le décompte passe en orange (réglage d'affichage).
const WARNING_SECONDS = 60;

function remainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/**
 * Bug corrigé : la réservation des places (TTL côté order-service,
 * stock_reservation_ttl_seconds) expirait sans que la page ne le montre
 * jamais — l'acheteur remplissait tout le formulaire pour tomber sur
 * « Réservation expirée ou invalide ». Décompte visible + bascule
 * automatique à zéro (onExpire).
 */
export function ReservationTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      const left = remainingSeconds(expiresAt);
      setSeconds(left);
      if (left === 0) onExpire();
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  if (seconds === null) return null;

  const warning = seconds <= WARNING_SECONDS;
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      role="timer"
      aria-live={warning ? "assertive" : "off"}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
        warning ? "bg-warning/10 text-warning ring-warning/30" : "bg-hairline-1 text-ink-3 ring-hairline-2"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M9 2h6" />
      </svg>
      <span>
        Vos places sont réservées pendant{" "}
        <strong className="font-mono tabular-nums">{label}</strong>
        {warning ? " — terminez vite votre commande !" : ""}
      </span>
    </div>
  );
}
