// Types + styles du tableau de bord organisateur — les données réelles
// viennent de apiOrganizerDashboardToStats()/apiEventSummaryToOrganizerEvent()
// (lib/mappers/dashboard-mappers.ts).

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
  | "SUSPENDED";

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
}

export const statusBadgeStyles: Record<
  OrganizerEventStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Brouillon",
    className: "bg-hairline-2 text-ink-3 ring-1 ring-inset ring-white/15",
  },
  PENDING_VALIDATION: {
    label: "⏳ En validation",
    className:
      "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  PUBLISHED: {
    label: "● Publié",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  CANCELLED: {
    label: "Annulé",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  TERMINATED: {
    label: "Terminé",
    className: "bg-hairline-2 text-ink-4 ring-1 ring-inset ring-white/15",
  },
  ARCHIVED: {
    label: "Archivé",
    className: "bg-hairline-2 text-ink-5 ring-1 ring-inset ring-white/15",
  },
  SUSPENDED: {
    label: "Suspendu",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
};
