import type { AdminStat } from "@/lib/mappers/admin-mappers";

export function AdminStatCard({ stat }: { stat: AdminStat }) {
  return (
    <div className="rounded-2xl border border-hairline-1 bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-5">
        {stat.label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${stat.valueClassName ?? "text-ink-1"}`}>
        {stat.value}
      </p>
    </div>
  );
}
