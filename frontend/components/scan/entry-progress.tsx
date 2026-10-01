"use client";

import { cardClass } from "@/components/ui/card";
import { time } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";

// Entrées de l'événement : chiffres du serveur en ligne, du téléphone hors ligne.

export function EntryProgress({
  admitted,
  expected,
  live,
  updatedAt,
}: {
  admitted: number;
  expected: number;
  /** true : chiffres du serveur ; false : liste enregistrée sur le téléphone. */
  live: boolean;
  updatedAt: Date;
}) {
  const percent = expected > 0 ? Math.min(100, Math.round((admitted / expected) * 100)) : 0;
  const waiting = Math.max(0, expected - admitted);

  return (
    <section aria-label={t("Entrées de l'événement")} className={cardClass("p-4")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-5">{t("Entrées de l'événement")}</p>
        <p className="text-[11px] text-ink-5">
          {live ? t("Tous les agents · {value}", { value: time.format(updatedAt) }) : t("Sans réseau · liste de {value}", { value: time.format(updatedAt) })}
        </p>
      </div>

      {expected === 0 ? (
        <p className="mt-2 text-sm text-ink-4">{t("Aucun billet vendu pour cet événement.")}</p>
      ) : (
        <>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tabular-nums text-ink-1">{admitted}</span>
            <span className="text-lg font-semibold tabular-nums text-ink-5">/ {expected}</span>
            <span className="ml-auto text-sm font-bold tabular-nums text-emerald-600">{percent} %</span>
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={expected}
            aria-valuenow={admitted}
            aria-label={t("Participants entrés")}
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-hairline-2"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-5">
            {waiting === 0
              ? t("Tous les participants sont entrés.")
              : `${waiting} participant${waiting > 1 ? "s" : ""} encore attendu${waiting > 1 ? "s" : ""}`}
          </p>
        </>
      )}
    </section>
  );
}
