// Filtres et styles de l'audit trail — les entrées viennent de
// GET /admin/audit-logs (cf. components/admin/audit-explorer.tsx).

export type AuditEntityType =
  | "USER"
  | "EVENT"
  | "ORDER"
  | "TICKET"
  | "PAYMENT"
  | "PAYOUT"
  | "DISPUTE";

export interface AuditEntry {
  id: string;
  timestampLabel: string;
  action: string;
  entityType: AuditEntityType;
  entityLabel: string;
  performedBy: string;
  reason: string;
}

export const entityTypeFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "EVENT", label: "Événements" },
  { id: "USER", label: "Utilisateurs" },
  { id: "ORDER", label: "Commandes" },
  { id: "TICKET", label: "Billets" },
  { id: "PAYMENT", label: "Paiements" },
  { id: "PAYOUT", label: "Reversements" },
  { id: "DISPUTE", label: "Litiges" },
];

export const entityTypeBadgeStyles: Record<AuditEntityType, string> = {
  USER: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  EVENT: "bg-blue-500/15 text-accent ring-1 ring-inset ring-blue-500/30",
  ORDER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  TICKET: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  PAYMENT: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  PAYOUT: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  DISPUTE: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
};
