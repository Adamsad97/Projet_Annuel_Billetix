import type { ApiWithdrawnTicket } from "@/lib/api/tickets";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Billet reçu puis retiré : le transfert a été annulé à la demande de l'expéditeur. */
export function WithdrawnTicketRow({ item }: { item: ApiWithdrawnTicket }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hairline-1 text-lg">↩️</span>
        <div>
          <p className="text-sm font-bold text-ink-1">
            {item.event_name} — {item.ticket_category_name}
          </p>
          <p className="text-xs text-ink-5">
            {dateFormatter.format(new Date(item.event_start_at))} · billet {item.ticket_reference}
          </p>
          <p className="mt-0.5 text-xs text-ink-4">
            Reçu de {item.from_first_name} {item.from_last_name} le {dateFormatter.format(new Date(item.received_at))}, retiré
            {item.reverted_at ? ` le ${dateFormatter.format(new Date(item.reverted_at))}` : ""} (transfert annulé à sa demande).
          </p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">
        Retiré
      </span>
    </div>
  );
}
