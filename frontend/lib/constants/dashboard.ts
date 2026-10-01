import { msg } from "@/lib/i18n/translate";
// Types et styles du tableau de bord organisateur (données via lib/mappers/dashboard-mappers.ts).

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  accent: string; // classe Tailwind pour la barre d'accent en haut de carte
}

export type OrganizerEventStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "PUBLISHED"
  | "CANCELLED"
  | "TERMINATED"
  | "ARCHIVED"
  | "SUSPENDED"
  | "POSTPONED";

export interface OrganizerEvent {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  status: OrganizerEventStatus;
  emoji: string;
  iconBg: string;
  progressColor: string;
  progressPercent: number;
  progressLabel: string;
  amountLabel: string;
  amountSubLabel: string;
  /** Masqué au public par l'administration. */
  isHidden?: boolean;
}

export const statusBadgeStyles: Record<
  OrganizerEventStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: msg("Brouillon"),
    className: "bg-hairline-2 text-ink-3 ring-1 ring-inset ring-white/15",
  },
  PENDING_VALIDATION: {
    label: msg("⏳ En validation"),
    className:
      "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  PUBLISHED: {
    label: msg("● Publié"),
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  CANCELLED: {
    label: msg("Annulé"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  TERMINATED: {
    label: msg("Terminé"),
    className: "bg-hairline-2 text-ink-4 ring-1 ring-inset ring-white/15",
  },
  ARCHIVED: {
    label: msg("Archivé"),
    className: "bg-hairline-2 text-ink-5 ring-1 ring-inset ring-white/15",
  },
  SUSPENDED: {
    label: msg("Désactivé"),
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  POSTPONED: {
    label: msg("Reporté"),
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
};
