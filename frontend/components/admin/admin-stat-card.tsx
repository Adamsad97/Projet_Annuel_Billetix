import type { AdminStat } from "@/lib/mappers/admin-mappers";
import { cardClass } from "@/components/ui/card";

export function AdminStatCard({ stat }: { stat: AdminStat }) {
  return (
    <div className={cardClass("p-5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-5">
        {stat.label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${stat.valueClassName ?? "text-ink-1"}`}>
        {stat.value}
      </p>
    </div>
  );
}
