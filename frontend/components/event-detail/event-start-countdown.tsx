"use client";

import { useEffect, useState } from "react";
import { CountdownDigits } from "@/components/event-detail/sales-countdown";

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Compte à rebours jusqu'au début de l'événement, dans l'en-tête. Avant
 * l'ouverture des ventes, c'est la carte billets qui affiche le sien
 * (ouverture des ventes) : celui-ci prend le relais dès qu'elles ouvrent,
 * sans recharger la page, et disparaît à l'heure du début.
 */
export function EventStartCountdown({ salesStartIso, startIso }: { salesStartIso: string; startIso: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const salesStart = new Date(salesStartIso).getTime();
    const start = new Date(startIso).getTime();
    const now = Date.now();
    if (now >= start) return;
    if (now >= salesStart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- heure lue après le montage (hydratation)
      setVisible(true);
      return;
    }
    // Au-delà de ~24,8 jours, setTimeout se déclencherait immédiatement :
    // ouverture trop lointaine pour qu'une page reste ouverte jusque-là.
    if (salesStart - now > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => setVisible(true), salesStart - now);
    return () => clearTimeout(timer);
  }, [salesStartIso, startIso]);

  if (!visible) return null;

  return (
    <div className="mt-8 max-w-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">L&apos;événement commence dans</p>
      <CountdownDigits targetIso={startIso} onZero={() => setVisible(false)} />
    </div>
  );
}
