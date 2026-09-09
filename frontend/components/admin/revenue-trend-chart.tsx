// Graphique de tendance des ventes, autonome : gère lui-même la plage de
// dates et la métrique affichée (ventes totales / total billets / chiffre
// d'affaires), et va chercher les données sur GET /admin/sales-trend à
// chaque changement.

import { useEffect, useState } from "react";
import { getSalesTrend, type ApiSalesTrendPoint } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

type Metric = "orders_count" | "tickets_count" | "revenue_ttc";

const METRICS: Array<{ id: Metric; label: string; format: (value: number) => string }> = [
  { id: "orders_count", label: "Ventes totales", format: (value) => `${value}` },
  { id: "tickets_count", label: "Total billets", format: (value) => `${value}` },
  { id: "revenue_ttc", label: "Chiffre d'affaires", format: (value) => currency.format(value) },
];

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const defaultTo = new Date();
const defaultFrom = new Date(defaultTo.getTime() - 29 * 24 * 60 * 60 * 1000);

export function RevenueTrendChart() {
  const [metric, setMetric] = useState<Metric>("revenue_ttc");
  const [from, setFrom] = useState(toDateInputValue(defaultFrom));
  const [to, setTo] = useState(toDateInputValue(defaultTo));
  const [trend, setTrend] = useState<ApiSalesTrendPoint[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTrend(undefined);
    setError(null);
    getSalesTrend(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`)
      .then(setTrend)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger la tendance des ventes."));
  }, [from, to]);

  const activeMetric = METRICS.find((entry) => entry.id === metric)!;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setMetric(entry.id)}
              className={
                entry.id === metric
                  ? "rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
          <span>→</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toDateInputValue(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-gray-200 [color-scheme:dark]"
          />
        </div>
      </div>

      {error ? (
        <p className="px-1 py-6 text-center text-sm text-red-300">{error}</p>
      ) : trend === undefined ? (
        <p className="px-1 py-6 text-center text-sm text-gray-500">Chargement…</p>
      ) : trend.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-gray-500">Pas encore de données de vente sur cette période.</p>
      ) : (
        <div className="flex items-end gap-2 overflow-x-auto" style={{ height: 160 }}>
          {trend.map((point) => {
            const maxValue = Math.max(...trend.map((entry) => entry[metric]), 1);
            const value = point[metric];
            const heightPercent = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
            return (
              <div key={point.day} className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-medium text-gray-400">{activeMetric.format(value)}</span>
                <div
                  title={`${dayFormatter.format(new Date(point.day))} — ${activeMetric.format(value)}`}
                  className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-500 transition-opacity hover:opacity-80"
                  style={{ height: `${heightPercent}%`, minHeight: value > 0 ? 4 : 0 }}
                />
                <span className="text-[11px] text-gray-500">{dayFormatter.format(new Date(point.day))}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
