"use client";

import type { DashboardStat } from "@/lib/constants/dashboard";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export function StatCard({ stat }: { stat: DashboardStat }) {
  return (
    <div className={cardClass("overflow-hidden")}>
      <div className={`h-1 w-full ${stat.accent}`} />
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-5">
          {t(stat.label)}
        </p>
        <p className="mt-2 text-3xl font-bold text-ink-1">{stat.value}</p>
        {stat.trend ? (
          <p
            className={
              stat.trendPositive
                ? "mt-1 text-sm font-medium text-emerald-400"
                : "mt-1 text-sm text-ink-5"
            }
          >
            {stat.trend}
          </p>
        ) : null}
      </div>
    </div>
  );
}
