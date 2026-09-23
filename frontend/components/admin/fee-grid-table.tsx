import { feeGrid } from "@/lib/mock/admin-commissions";

export function FeeGridTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
      <div className="hidden grid-cols-[1fr_100px_100px_1fr] gap-4 border-b border-white/5 px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid">
        <span>Prestataire</span>
        <span>Frais %</span>
        <span>Frais fixe</span>
        <span>Note</span>
      </div>

      {feeGrid.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-2 gap-3 border-b border-white/5 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_100px_100px_1fr] sm:items-center sm:gap-4"
        >
          <span className="col-span-2 flex items-center gap-2 text-sm font-bold text-white sm:col-span-1">
            <span>{row.emoji}</span>
            {row.provider}
          </span>
          <span className="text-sm text-violet-300">{row.percent}</span>
          <span className="text-sm text-violet-300">{row.fixed}</span>
          <span className="col-span-2 text-xs text-gray-500 sm:col-span-1">
            {row.note}
          </span>
        </div>
      ))}
    </div>
  );
}
