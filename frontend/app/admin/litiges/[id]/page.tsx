import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { adminDisputes, disputeStatusBadge } from "@/lib/mock/admin-disputes";

export function generateStaticParams() {
  return adminDisputes.map((dispute) => ({ id: dispute.id }));
}

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dispute = adminDisputes.find((d) => d.id === id);

  if (!dispute) {
    notFound();
  }

  const badge = disputeStatusBadge[dispute.status];
  const isOpen = dispute.status === "open" || dispute.status === "in_progress";

  return (
    <AdminShell active="/admin/litiges">
      <Link
        href="/admin/litiges"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
      >
        ← Litiges
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-1">
            {dispute.orderRef} · {dispute.event}
          </h1>
          <p className="text-sm text-ink-5">
            {dispute.buyer} · {dispute.openedLabel}
          </p>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <span className="text-2xl font-bold text-ink-1">{dispute.amountLabel}</span>
      </div>

      <div className="rounded-2xl border border-hairline-1 bg-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Motif</h2>
        <p className="text-sm text-ink-4">{dispute.reason}</p>
      </div>

      {isOpen ? (
        <div className="mt-6 rounded-2xl border border-hairline-1 bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-2">Résolution</h2>
          <textarea
            rows={3}
            placeholder="Note de résolution, échanges avec l'acheteur/organisateur…"
            className="w-full resize-none rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25"
            >
              ✓ Rembourser
            </button>
            <button
              type="button"
              className="rounded-lg bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
            >
              Marquer résolu
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25"
            >
              ✕ Rejeter
            </button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
