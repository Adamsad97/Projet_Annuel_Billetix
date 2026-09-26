import Link from "next/link";
import { ticketStatusBadge, type ProfileTicket } from "@/lib/mock/profile";

export function TicketRow({ ticket }: { ticket: ProfileTicket }) {
  const badge = ticketStatusBadge[ticket.status];

  return (
    <Link
      href={`/billets/${ticket.id}`}
      className="flex items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 transition-colors last:border-b-0 hover:bg-hairline-1"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${ticket.iconBg}`}
        >
          {ticket.emoji}
        </span>
        <div>
          <p className="text-sm font-bold text-ink-1">{ticket.title}</p>
          <p className="text-xs text-ink-5">
            {ticket.dateLabel} · {ticket.venue}
          </p>
          {ticket.receivedFromLabel ? (
            <p className="mt-0.5 text-xs font-medium text-accent">🎁 {ticket.receivedFromLabel}</p>
          ) : null}
          {ticket.resalePurchaseLabel ? (
            <p className="mt-0.5 text-xs font-medium text-accent">🔄 {ticket.resalePurchaseLabel}</p>
          ) : null}
        </div>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
    </Link>
  );
}
