// Convertit les données réelles (api-gateway /events/me/dashboard,
// /payments/payouts/me) vers les formes attendues par les composants du
// tableau de bord organisateur (StatCard/OrganizerEventRow), construits à
// l'origine pour des données de démonstration.

import type { ApiOrganizerDashboard, ApiOrganizerEventSummary, ApiEventStatus } from "@/lib/api/organizer";
import type { DashboardStat, OrganizerEvent } from "@/lib/mock/dashboard";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Une seule icône/couleur par catégorie — les événements réels n'ont pas de
// déco par-événement comme la maquette d'origine, une couleur par catégorie
// reste plus parlante qu'un style générique unique.
const CATEGORY_STYLE: Record<string, { emoji: string; iconBg: string; progressColor: string }> = {
  CONCERT: { emoji: "🎧", iconBg: "bg-violet-500/15", progressColor: "bg-violet-500" },
  THEATRE: { emoji: "🎭", iconBg: "bg-amber-500/15", progressColor: "bg-amber-500" },
  DANSE: { emoji: "💃", iconBg: "bg-pink-500/15", progressColor: "bg-pink-500" },
  FESTIVAL: { emoji: "🎪", iconBg: "bg-fuchsia-500/15", progressColor: "bg-fuchsia-500" },
  CONFERENCE: { emoji: "💡", iconBg: "bg-blue-500/15", progressColor: "bg-blue-500" },
  SPORT: { emoji: "⚽", iconBg: "bg-emerald-500/15", progressColor: "bg-emerald-500" },
  AUTRE: { emoji: "🎫", iconBg: "bg-white/10", progressColor: "bg-gray-400" },
};

export function apiEventSummaryToOrganizerEvent(event: ApiOrganizerEventSummary): OrganizerEvent {
  const style = CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.AUTRE;
  const hasQuota = event.total_quota > 0;
  const fillRate = Math.round(event.fill_rate);

  return {
    id: event.id,
    title: event.title,
    dateLabel: dateFormatter.format(new Date(event.start_date)),
    venue: [event.venue_name, event.venue_city].filter(Boolean).join(", "),
    status: event.status as OrganizerEvent["status"],
    emoji: style.emoji,
    iconBg: style.iconBg,
    progressColor: style.progressColor,
    progressPercent: hasQuota ? fillRate : 0,
    progressLabel: hasQuota
      ? `${event.sold} / ${event.total_quota} billets (${fillRate}%)`
      : event.status === "PUBLISHED"
        ? "Ventes en cours"
        : "Ventes pas encore ouvertes",
    amountLabel: currency.format(Number(event.revenue_ttc)),
    amountSubLabel: "chiffre d'affaires TTC",
  };
}

export function buildOrganizerDashboardStats(
  dashboard: ApiOrganizerDashboard,
  nextPayoutDate: string | null,
): DashboardStat[] {
  const pendingValidationCount = dashboard.events.filter(
    (event) => (event.status as ApiEventStatus) === "PENDING_VALIDATION",
  ).length;
  const activeCount = dashboard.events.filter(
    (event) =>
      (event.status as ApiEventStatus) === "PUBLISHED" && new Date(event.start_date) > new Date(),
  ).length;

  return [
    {
      id: "revenue",
      label: "Ventes totales",
      value: currency.format(Number(dashboard.totals.revenue_ttc)),
      accent: "bg-violet-500",
    },
    {
      id: "tickets",
      label: "Billets vendus",
      value: String(dashboard.totals.tickets_sold),
      accent: "bg-amber-500",
    },
    {
      id: "events",
      label: "Événements actifs",
      value: String(activeCount),
      trend: pendingValidationCount > 0 ? `${pendingValidationCount} en attente de validation` : undefined,
      accent: "bg-emerald-500",
    },
    {
      id: "payout",
      label: "Prochain reversement",
      value: currency.format(Number(dashboard.totals.pending_balance)),
      trend: nextPayoutDate
        ? `Prévu le ${dateFormatter.format(new Date(nextPayoutDate))}`
        : "Aucun reversement en attente",
      accent: "bg-blue-500",
    },
  ];
}
