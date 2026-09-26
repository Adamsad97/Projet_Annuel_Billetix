import Link from "next/link";
import { orderStatusBadge, type ProfileOrder } from "@/lib/mock/profile";

export function OrderRow({ order }: { order: ProfileOrder }) {
  const badge = orderStatusBadge[order.status];

  return (
    <Link
      href={`/profil/commandes/${order.id ?? order.reference}`}
      className="flex items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 transition-colors last:border-b-0 hover:bg-hairline-1"
    >
      <div>
        <p className="text-sm font-bold text-ink-1">
          {order.reference} · {order.amountLabel}
        </p>
        <p className="text-xs text-ink-5">
          {order.dateLabel} · {order.ticketCountLabel}
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
    </Link>
  );
}
