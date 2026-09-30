"use client";

// Barème réel, lu dans les paramètres de la plateforme (sections réservées
// au super admin : un admin voit un message à la place).

import { useEffect, useState } from "react";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { listPlatformSettings, type ApiPlatformSetting } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { euros as euro } from "@/lib/format/money";
import { cardClass } from "@/components/ui/card";

const PROVIDERS = [
  { id: "stripe", label: "Carte bancaire (Stripe)", emoji: "💳" },
  { id: "paypal", label: "PayPal", emoji: "🅿️" },
  { id: "orange_money", label: "Orange Money", emoji: "🟠" },
  { id: "wave", label: "Wave", emoji: "🌊" },
];

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function formatPercent(value: string | undefined): string {
  return value === undefined ? "—" : `${number.format(Number(value))} %`;
}

function formatEuro(value: string | undefined): string {
  return value === undefined ? "—" : euro.format(Number(value));
}

export function FeeGridTable() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPlatformSettings()
      .then((list: ApiPlatformSetting[]) => setSettings(Object.fromEntries(list.map((s) => [s.key, s.value]))))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger le barème."));
  }, []);

  if (settings === null) {
    return <p className={cardClass("px-5 py-6 text-sm text-ink-5")}>{error ?? "Chargement…"}</p>;
  }

  if (settings.commission_standard_percent === undefined) {
    return (
      <p className={cardClass("px-5 py-6 text-sm text-ink-5")}>
        Le barème des commissions est réservé au super admin.
      </p>
    );
  }

  const stats = [
    { id: "standard", label: "Commission standard", value: `${formatPercent(settings.commission_standard_percent)} du HT` },
    {
      id: "large",
      label: `Grand événement (dès ${settings.large_event_threshold ?? "—"} places)`,
      value: `${formatPercent(settings.commission_large_event_percent)} du HT`,
    },
    { id: "free", label: "Frais par billet gratuit", value: formatEuro(settings.free_ticket_fee_eur) },
  ];

  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <AdminStatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <div className={cardClass("overflow-hidden")}>
        <div className="hidden grid-cols-[1fr_120px_140px] gap-4 border-b border-hairline-1 px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-5 sm:grid">
          <span>Moyen de paiement</span>
          <span>Frais %</span>
          <span>Frais fixes</span>
        </div>

        {PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className="grid grid-cols-2 gap-3 border-b border-hairline-1 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_120px_140px] sm:items-center sm:gap-4"
          >
            <span className="col-span-2 flex items-center gap-2 text-sm font-bold text-ink-1 sm:col-span-1">
              <span aria-hidden="true">{provider.emoji}</span>
              {provider.label}
            </span>
            <span className="text-sm text-accent">{formatPercent(settings[`${provider.id}_fee_percent`])}</span>
            <span className="text-sm text-accent">{formatEuro(settings[`${provider.id}_fee_fixed_eur`])}</span>
          </div>
        ))}
      </div>
    </>
  );
}
