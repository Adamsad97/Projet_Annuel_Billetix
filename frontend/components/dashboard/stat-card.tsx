import type { DashboardStat } from "@/lib/mock/dashboard";

export function StatCard({ stat }: { stat: DashboardStat }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
      <div className={`h-1 w-full ${stat.accent}`} />
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {stat.label}
        </p>
        <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
        {stat.trend ? (
          <p
            className={
              stat.trendPositive
                ? "mt-1 text-sm font-medium text-emerald-400"
                : "mt-1 text-sm text-gray-500"
            }
          >
            {stat.trend}
          </p>
        ) : null}
      </div>
    </div>
  );
}
