"use client";

import type { ApiResoldTicket } from "@/lib/api/tickets";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateFormatter, longDateTime as dateTimeFormatter } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";

/** Billet revendu : trace en lecture seule pour le vendeur. */
export function ResoldTicketRow({ item }: { item: ApiResoldTicket }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hairline-1 text-lg">🔄</span>
        <div>
          <p className="text-sm font-bold text-ink-1">
            {item.event_name ?? t("Événement")}
            {item.ticket_category_name ? ` — ${item.ticket_category_name}` : ""}
          </p>
          <p className="text-xs text-ink-5">
            {dateFormatter.format(new Date(item.event_start_at))}
            {item.ticket_reference ? ` · ${t("billet {reference}", { reference: item.ticket_reference })}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-ink-4">{item.sold_at ? t("Revendu {price} le {date} (mis en vente le {listed})", { price: currency.format(item.resale_price), date: dateTimeFormatter.format(new Date(item.sold_at)), listed: dateFormatter.format(new Date(item.listed_at)) }) : t("Revendu {price} (mis en vente le {listed})", { price: currency.format(item.resale_price), listed: dateFormatter.format(new Date(item.listed_at)) })}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-hairline-1 px-2.5 py-1 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">{t("Revendu")}</span>
    </div>
  );
}
