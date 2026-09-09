import type { AdminStat } from "@/lib/mappers/admin-mappers";

export function AdminStatCard({ stat }: { stat: AdminStat }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {stat.label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${stat.valueClassName ?? "text-white"}`}>
        {stat.value}
      </p>
    </div>
  );
}
