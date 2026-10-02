"use client";

import { t } from "@/lib/i18n/translate";
import { useRealtimeConnected } from "@/lib/realtime/socket";

/** Pastille « En direct » : les chiffres de la page se mettent à jour seuls. */
export function LiveBadge() {
  const connected = useRealtimeConnected();
  if (!connected) return null;
  return (
    <span
      title={t("Les ventes et les entrées s'affichent ici en temps réel.")}
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-emerald-500/30"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {t("En direct")}
    </span>
  );
}
