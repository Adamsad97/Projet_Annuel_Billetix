"use client";

// Vue organisateur d'un événement : état de la billetterie, indicateurs,
// détail financier et reversement, billets par catégorie et fiche pratique.
// Uniquement de la présentation : les données viennent de la page
// (GET /events/:id/dashboard, /events/:id/categories, /payments/payouts/me).

import type { ReactNode } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import type { ApiCategory } from "@/lib/api/categories";
import { ticketVisibilityLabels, type ApiEventDashboardDetail, type ApiTicketCategory } from "@/lib/api/events";
import type { ApiPayout } from "@/lib/api/organizer";
import { payoutStatusBadge } from "@/lib/constants/dashboard-finances";
import { euros as currency } from "@/lib/format/money";
import { dateTime as shortDateTime } from "@/lib/format/dates";
import { cardClass } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink-1">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card px-5 py-3.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-5">{label}</dt>
      <dd className="text-sm text-ink-1">{children}</dd>
    </div>
  );
}

/** « Dans 12 jours », « Demain », « En cours », « Terminé ». */
export function eventTiming(start: string, end: string, now = new Date()): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (now > endDate) return "Terminé";
  if (now >= startDate) return "En cours";
  const days = Math.ceil((startDate.getTime() - now.getTime()) / 86_400_000);
  if (days <= 1) return startDate.getDate() === now.getDate() ? "Aujourd'hui" : "Demain";
  return `Dans ${days} jours`;
}

function salesState(detail: ApiEventDashboardDetail, now = new Date()): { label: string; tone: "open" | "soon" | "closed" | "off" } {
  const { event, fill_stats } = detail;
  if (event.is_hidden) return { label: "Ventes bloquées : l'événement est masqué au public par l'administration.", tone: "closed" };
  if (event.status === "SUSPENDED") return { label: "Ventes suspendues par l'administration.", tone: "closed" };
  if (event.status === "POSTPONED") return { label: "Événement reporté : les ventes reprendront à la nouvelle date.", tone: "closed" };
  if (event.status === "CANCELLED") return { label: "Événement annulé : les acheteurs sont remboursés.", tone: "off" };
  if (event.status === "TERMINATED" || event.status === "ARCHIVED") return { label: "Événement terminé.", tone: "off" };
  if (event.status !== "PUBLISHED") return { label: "Billetterie fermée : l'événement n'est pas encore publié.", tone: "off" };
  const salesStart = new Date(event.sales_start_date);
  const salesEnd = new Date(event.sales_end_date);
  if (fill_stats.total_quota > 0 && fill_stats.remaining === 0) return { label: "Complet : toutes les places sont vendues.", tone: "closed" };
  if (now < salesStart) return { label: `Ouverture des ventes le ${shortDateTime.format(salesStart)}.`, tone: "soon" };
  if (now > salesEnd) return { label: `Ventes terminées depuis le ${shortDateTime.format(salesEnd)}.`, tone: "closed" };
  return { label: `Billetterie ouverte jusqu'au ${shortDateTime.format(salesEnd)}.`, tone: "open" };
}

const toneStyles = {
  open: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  soon: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  closed: "border-hairline-2 bg-hairline-1 text-ink-3",
  off: "border-hairline-2 bg-hairline-1 text-ink-4",
};

export function EventOrganizerOverview({
  detail,
  ticketCategories,
  eventCategory,
  payout,
  viewer = "ORGANIZER",
}: {
  detail: ApiEventDashboardDetail;
  ticketCategories: ApiTicketCategory[];
  eventCategory: ApiCategory | undefined;
  payout: ApiPayout | undefined | null;
  viewer?: "ORGANIZER" | "ADMIN";
}) {
  const { event, fill_stats, revenue, tickets } = detail;
  const sales = salesState(detail);
  const vat = Math.max(0, revenue.revenue_ttc - revenue.revenue_ht);
  const categoryById = new Map(ticketCategories.map((category) => [category.id, category]));
  const address = [event.venue_address_line1, event.venue_address_line2, `${event.venue_postal_code} ${event.venue_city}`, event.venue_country]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name}, ${address}`)}`;

  return (
    <>
      <div className={`mb-6 rounded-2xl border px-5 py-3.5 text-sm font-medium ${toneStyles[sales.tone]}`} role="status">
        {sales.label}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          stat={{
            id: "sold",
            label: "Billets vendus",
            value: `${fill_stats.sold} / ${fill_stats.total_quota}`,
            trend: `${Math.round(fill_stats.fill_rate)} % de remplissage`,
            accent: "bg-blue-500",
          }}
        />
        <StatCard stat={{ id: "revenue", label: "Chiffre d'affaires TTC", value: currency.format(revenue.revenue_ttc), trend: `${revenue.orders_count} commande${revenue.orders_count > 1 ? "s" : ""}`, accent: "bg-amber-500" }} />
        <StatCard stat={{ id: "net", label: "Revenu net estimé", value: currency.format(revenue.net_organizer_amount), accent: "bg-emerald-500" }} />
        <StatCard
          stat={{
            id: "checked",
            label: "Entrées scannées",
            value: `${tickets.used} / ${tickets.total}`,
            trend: `${tickets.active} à scanner`,
            accent: "bg-blue-500",
          }}
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Finances">
          <dl className={cardClass("divide-y divide-hairline-1 overflow-hidden")}>
            <div className="flex justify-between px-5 py-3 text-sm"><dt className="text-ink-4">Chiffre d&apos;affaires TTC</dt><dd className="font-medium text-ink-1">{currency.format(revenue.revenue_ttc)}</dd></div>
            <div className="flex justify-between px-5 py-3 text-sm"><dt className="text-ink-4">dont TVA</dt><dd className="text-ink-3">− {currency.format(vat)}</dd></div>
            <div className="flex justify-between px-5 py-3 text-sm"><dt className="text-ink-4">Chiffre d&apos;affaires HT</dt><dd className="text-ink-1">{currency.format(revenue.revenue_ht)}</dd></div>
            <div className="flex justify-between px-5 py-3 text-sm"><dt className="text-ink-4">Commission de la plateforme</dt><dd className="text-ink-3">− {currency.format(revenue.total_commission)}</dd></div>
            <div className="flex justify-between px-5 py-3 text-sm font-semibold"><dt className="text-ink-2">Revenu net estimé</dt><dd className="text-ink-1">{currency.format(revenue.net_organizer_amount)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-ink-5">Les frais du moyen de paiement sont déduits au moment du reversement.</p>
        </Section>

        <Section title="Reversement">
          <div className={cardClass("px-5 py-4 text-sm")}>
            {payout ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-2xl font-bold text-ink-1">{currency.format(Number(payout.net_amount))}</span>
                  <Badge tone={payoutStatusBadge[payout.status].className}>
                    {payoutStatusBadge[payout.status].label}
                  </Badge>
                </div>
                <p className="text-ink-4">
                  {payout.status === "COMPLETED" && payout.processed_at
                    ? `Versé le ${shortDate.format(new Date(payout.processed_at))}.`
                    : `Versement prévu le ${shortDate.format(new Date(payout.scheduled_at))}.`}
                </p>
                <p className="text-xs text-ink-5">
                  Brut {currency.format(Number(payout.gross_amount))} · commission {currency.format(Number(payout.commission_amount))} · frais de paiement{" "}
                  {currency.format(Number(payout.payment_fees_amount))}
                </p>
                {payout.blocked_reason ? <p className="text-xs text-danger">Bloqué : {payout.blocked_reason}</p> : null}
              </div>
            ) : (
              <p className="text-ink-4">
                {viewer === "ADMIN"
                  ? "Aucun reversement pour le moment : il est créé après l'événement, une fois les ventes arrêtées."
                  : "Le reversement est créé après l'événement, une fois les ventes arrêtées. Vous suivez ensuite son avancement ici et dans Finances."}
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="Billets">
        <div className={cardClass("overflow-x-auto")}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-hairline-1 text-left text-xs font-medium uppercase tracking-wide text-ink-5">
                <th className="px-5 py-3">Catégorie</th>
                <th className="px-5 py-3">Prix client (TTC)</th>
                <th className="px-5 py-3">Vendus</th>
                <th className="px-5 py-3">Restants</th>
                <th className="px-5 py-3">Visibilité</th>
              </tr>
            </thead>
            <tbody>
              {fill_stats.categories.map((category) => {
                const details = categoryById.get(category.id);
                const percent = category.quota > 0 ? Math.round((category.sold / category.quota) * 100) : 0;
                return (
                  <tr key={category.id} className="border-b border-hairline-1 last:border-b-0">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-ink-1">{category.name}</p>
                      <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-hairline-1">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">
                      {details ? currency.format(details.price_ttc) : "—"}
                      <span className="block text-xs text-ink-5">{currency.format(category.price_ht)} HT</span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">
                      {category.sold} / {category.quota}
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">{category.remaining_quota}</td>
                    <td className="px-5 py-3.5 text-ink-4">
                      {details ? ticketVisibilityLabels[details.visibility] ?? details.visibility : "Désactivée"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tickets.for_resale > 0 || tickets.cancelled > 0 ? (
          <p className="mt-2 text-xs text-ink-5">
            {tickets.for_resale > 0 ? `${tickets.for_resale} billet${tickets.for_resale > 1 ? "s" : ""} en revente. ` : ""}
            {tickets.cancelled > 0 ? `${tickets.cancelled} billet${tickets.cancelled > 1 ? "s" : ""} annulé${tickets.cancelled > 1 ? "s" : ""} ou remboursé${tickets.cancelled > 1 ? "s" : ""}.` : ""}
          </p>
        ) : null}
      </Section>

      <Section title="Informations">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline-1 bg-hairline-1 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
          <InfoItem label="Début">{dateTime.format(new Date(event.start_date))}</InfoItem>
          <InfoItem label="Fin">{dateTime.format(new Date(event.end_date))}</InfoItem>
          <InfoItem label="Lieu">
            {event.venue_name}
            <span className="block text-ink-4">{address}</span>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-link hover:text-link-hover">
              Voir sur la carte
            </a>
          </InfoItem>
          <InfoItem label="Catégorie">{eventCategory?.label ?? event.category}</InfoItem>
          <InfoItem label="Capacité">{event.total_capacity} places</InfoItem>
          <InfoItem label="Période de vente">
            Du {shortDateTime.format(new Date(event.sales_start_date))}
            <span className="block">au {shortDateTime.format(new Date(event.sales_end_date))}</span>
          </InfoItem>
          <InfoItem label="Remboursement">
            {event.refund_policy === "REFUNDABLE"
              ? `Remboursable${event.refund_deadline_days ? ` jusqu'à ${event.refund_deadline_days} jour${event.refund_deadline_days > 1 ? "s" : ""} avant` : ""}`
              : "Non remboursable"}
          </InfoItem>
          <InfoItem label="Validation">
            {event.validated_at ? `Validé le ${shortDateTime.format(new Date(event.validated_at))}` : "Pas encore validé"}
            {event.validation_requested_at ? (
              <span className="block text-ink-4">Soumis le {shortDateTime.format(new Date(event.validation_requested_at))}</span>
            ) : null}
          </InfoItem>
          {event.is_non_profit ? (
            <InfoItem label="Événement à but non lucratif">
              {event.non_profit_verified
                ? "Justificatif vérifié"
                : event.non_profit_rejected_at
                  ? `Justificatif refusé${event.non_profit_rejection_reason ? ` : ${event.non_profit_rejection_reason}` : ""}`
                  : "Justificatif en attente de vérification"}
            </InfoItem>
          ) : null}
          {event.access_conditions ? <InfoItem label="Conditions d'accès">{event.access_conditions}</InfoItem> : null}
        </dl>
      </Section>
    </>
  );
}
