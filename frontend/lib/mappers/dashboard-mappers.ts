// Convertit les données réelles (api-gateway /events/me/dashboard,
// /payments/payouts/me) vers les formes attendues par les composants du
// tableau de bord organisateur (StatCard/OrganizerEventRow), construits à
// l'origine pour des données de démonstration.

import type { ApiCategory } from "@/lib/api/categories";
import type { ApiOrganizerDashboard, ApiOrganizerEventSummary, ApiEventStatus } from "@/lib/api/organizer";
import type { DashboardStat, OrganizerEvent } from "@/lib/mock/dashboard";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Bug corrigé (valeur en dur) : une liste de 7 catégories figée ici décidait
// de l'emoji/couleur affichés, sans rapport avec les vraies catégories
// gérables depuis l'espace Admin (lib/api/categories.ts) — toute catégorie
// créée par un admin en dehors de cette liste retombait sur l'icône
// générique, même si un emoji réel était configuré pour elle. La couleur
// (déco absente du modèle Category, qui n'a que code/label/emoji) reste
// dérivée localement, par un hash stable du code plutôt qu'une table figée
// par nom de catégorie — n'importe quelle catégorie, même future, obtient
// une couleur cohérente sans modification de ce fichier.
const COLOR_PALETTE: Array<{ iconBg: string; progressColor: string }> = [
  { iconBg: "bg-violet-500/15", progressColor: "bg-violet-500" },
  { iconBg: "bg-amber-500/15", progressColor: "bg-amber-500" },
  { iconBg: "bg-pink-500/15", progressColor: "bg-pink-500" },
  { iconBg: "bg-fuchsia-500/15", progressColor: "bg-fuchsia-500" },
  { iconBg: "bg-blue-500/15", progressColor: "bg-blue-500" },
  { iconBg: "bg-emerald-500/15", progressColor: "bg-emerald-500" },
];

function colorForCategoryCode(code: string): { iconBg: string; progressColor: string } {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

export function apiEventSummaryToOrganizerEvent(
  event: ApiOrganizerEventSummary,
  categoriesByCode: Map<string, ApiCategory>,
): OrganizerEvent {
  const category = categoriesByCode.get(event.category);
  const color = colorForCategoryCode(event.category);
  const hasQuota = event.total_quota > 0;
  const fillRate = Math.round(event.fill_rate);

  return {
    id: event.id,
    title: event.title,
    dateLabel: dateFormatter.format(new Date(event.start_date)),
    venue: [event.venue_name, event.venue_city].filter(Boolean).join(", "),
    status: event.status as OrganizerEvent["status"],
    emoji: category?.emoji ?? "🎫",
    iconBg: color.iconBg,
    progressColor: color.progressColor,
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
