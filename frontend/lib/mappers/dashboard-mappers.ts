// Convertit les données réelles du tableau de bord organisateur pour ses composants.

import type { ApiCategory } from "@/lib/api/categories";
import type { ApiOrganizerDashboard, ApiOrganizerEventSummary, ApiEventStatus } from "@/lib/api/organizer";
import type { DashboardStat, OrganizerEvent } from "@/lib/constants/dashboard";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateFormatter } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";

// Emoji de la catégorie depuis le référentiel admin ; couleur dérivée d'un hash stable du code.
const COLOR_PALETTE: Array<{ iconBg: string; progressColor: string }> = [
  { iconBg: "bg-blue-500/15", progressColor: "bg-blue-500" },
  { iconBg: "bg-amber-500/15", progressColor: "bg-amber-500" },
  { iconBg: "bg-pink-500/15", progressColor: "bg-pink-500" },
  { iconBg: "bg-blue-500/15", progressColor: "bg-blue-500" },
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
      ? t("{sold} / {total} billets ({rate} %)", { sold: event.sold, total: event.total_quota, rate: fillRate })
      : event.status === "PUBLISHED"
        ? t("Ventes en cours")
        : t("Ventes pas encore ouvertes"),
    amountLabel: currency.format(Number(event.revenue_ttc)),
    amountSubLabel: "chiffre d'affaires TTC",
    isHidden: event.is_hidden ?? false,
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
      label: t("Ventes totales"),
      value: currency.format(Number(dashboard.totals.revenue_ttc)),
      accent: "bg-blue-500",
    },
    {
      id: "tickets",
      label: t("Billets vendus"),
      value: String(dashboard.totals.tickets_sold),
      accent: "bg-amber-500",
    },
    {
      id: "events",
      label: t("Événements actifs"),
      value: String(activeCount),
      trend: pendingValidationCount > 0 ? t("{pendingValidationCount} en attente de validation", { pendingValidationCount }) : undefined,
      accent: "bg-emerald-500",
    },
    {
      id: "payout",
      label: t("Prochain reversement"),
      value: currency.format(Number(dashboard.totals.pending_balance)),
      trend: nextPayoutDate
        ? t("Prévu le {value}", { value: dateFormatter.format(new Date(nextPayoutDate)) })
        : t("Aucun reversement en attente"),
      accent: "bg-blue-500",
    },
  ];
}
