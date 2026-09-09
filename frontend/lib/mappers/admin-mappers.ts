// Convertit les KPIs réels (GET /admin/dashboard) vers les cartes du
// dashboard admin, construit à l'origine pour des données de démonstration.

import type { ApiAdminDashboard, ApiAuditLogEntry } from "@/lib/api/admin";
import type { ApiEvent } from "@/lib/api/events";

export interface AdminStat {
  id: string;
  label: string;
  value: string;
  valueClassName?: string;
}

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function apiDashboardToAdminStats(dashboard: ApiAdminDashboard): AdminStat[] {
  const publishedEvents = dashboard.kpis.events_by_status["PUBLISHED"] ?? 0;

  return [
    {
      id: "active-events",
      label: "Événements publiés",
      value: String(publishedEvents),
      valueClassName: "text-white",
    },
    {
      id: "sales",
      label: "Ventes totales (TTC)",
      value: currency.format(dashboard.kpis.revenue_ttc),
      valueClassName: "text-emerald-400",
    },
    {
      id: "commissions",
      label: "Commissions",
      value: currency.format(dashboard.kpis.total_commission),
      valueClassName: "text-white",
    },
    {
      id: "open-disputes",
      label: "Litiges ouverts",
      value: String(dashboard.kpis.open_disputes),
      valueClassName: dashboard.kpis.open_disputes > 0 ? "text-red-400" : "text-white",
    },
  ];
}

export interface ValidationHistoryEntry {
  id: string;
  title: string;
  emoji: string;
  iconBg: string;
  performedBy: string;
  decidedLabel: string;
  reason?: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Construit une ligne d'historique à partir d'une entrée d'audit log
 * (EVENT_APPROVED/EVENT_REJECTED) + l'événement concerné, résolu séparément
 * (pas de dénormalisation du titre dans le journal d'audit lui-même). */
export function auditLogToValidationHistoryEntry(
  log: ApiAuditLogEntry,
  event: ApiEvent | undefined,
  categoryEmoji: string,
): ValidationHistoryEntry {
  return {
    id: log.id,
    title: event?.title ?? "Événement supprimé",
    emoji: categoryEmoji,
    iconBg: "bg-white/5",
    performedBy: log.performed_by_email,
    decidedLabel: `${log.action === "EVENT_APPROVED" ? "Validé" : "Rejeté"} le ${dateTimeFormatter.format(new Date(log.created_at))}`,
    reason: log.reason ?? undefined,
  };
}
