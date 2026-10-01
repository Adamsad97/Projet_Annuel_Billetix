// Convertit les KPIs réels (GET /admin/dashboard) vers les cartes du
// dashboard admin, construit à l'origine pour des données de démonstration.

import type { ApiAdminDashboard, ApiAuditLogEntry } from "@/lib/api/admin";
import type { ApiEvent } from "@/lib/api/events";
import { euros as currency } from "@/lib/format/money";
import { longDate as dateTimeFormatter } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";

export interface AdminStat {
  id: string;
  label: string;
  value: string;
  valueClassName?: string;
}

export function apiDashboardToAdminStats(dashboard: ApiAdminDashboard): AdminStat[] {
  const publishedEvents = dashboard.kpis.events_by_status["PUBLISHED"] ?? 0;

  return [
    {
      id: "active-events",
      label: t("Événements publiés"),
      value: String(publishedEvents),
      valueClassName: "text-ink-1",
    },
    {
      id: "sales",
      label: t("Ventes totales (TTC)"),
      value: currency.format(dashboard.kpis.revenue_ttc),
      valueClassName: "text-emerald-400",
    },
    {
      id: "commissions",
      label: t("Commissions"),
      value: currency.format(dashboard.kpis.total_commission),
      valueClassName: "text-ink-1",
    },
    {
      id: "open-disputes",
      label: t("Litiges ouverts"),
      value: String(dashboard.kpis.open_disputes),
      valueClassName: dashboard.kpis.open_disputes > 0 ? "text-red-400" : "text-ink-1",
    },
  ];
}

export interface ValidationHistoryEntry {
  id: string;
  // Distinct de `id` (celui de l'entrée d'audit log) — sert à lier vers la
  // fiche de l'événement. null si l'événement a depuis été supprimé.
  eventId: string | null;
  title: string;
  emoji: string;
  iconBg: string;
  performedBy: string;
  decidedLabel: string;
  reason?: string;
}

/** Ligne d'historique à partir d'une entrée d'audit et de l'événement concerné. */
export function auditLogToValidationHistoryEntry(
  log: ApiAuditLogEntry,
  event: ApiEvent | undefined,
  categoryEmoji: string,
): ValidationHistoryEntry {
  return {
    id: log.id,
    eventId: log.entity_id,
    title: event?.title ?? t("Événement supprimé"),
    emoji: categoryEmoji,
    iconBg: "bg-hairline-1",
    performedBy: log.performed_by_email,
    decidedLabel: log.action === "EVENT_APPROVED" ? t("Validé le {date}", { date: dateTimeFormatter.format(new Date(log.created_at)) }) : t("Rejeté le {date}", { date: dateTimeFormatter.format(new Date(log.created_at)) }),
    reason: log.reason ?? undefined,
  };
}
