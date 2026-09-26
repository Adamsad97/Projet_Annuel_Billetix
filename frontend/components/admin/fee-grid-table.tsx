import { feeGrid } from "@/lib/mock/admin-commissions";

export function FeeGridTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
      <div className="hidden grid-cols-[1fr_100px_100px_1fr] gap-4 border-b border-hairline-1 px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-5 sm:grid">
        <span>Prestataire</span>
        <span>Frais %</span>
        <span>Frais fixe</span>
        <span>Note</span>
      </div>

      {feeGrid.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-2 gap-3 border-b border-hairline-1 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_100px_100px_1fr] sm:items-center sm:gap-4"
        >
          <span className="col-span-2 flex items-center gap-2 text-sm font-bold text-ink-1 sm:col-span-1">
            <span>{row.emoji}</span>
            {row.provider}
          </span>
          <span className="text-sm text-accent">{row.percent}</span>
          <span className="text-sm text-accent">{row.fixed}</span>
          <span className="col-span-2 text-xs text-ink-5 sm:col-span-1">
            {row.note}
          </span>
        </div>
      ))}
    </div>
  );
}
