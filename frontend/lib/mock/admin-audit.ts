// Données de démonstration pour l'audit trail — aucun appel API, à
// remplacer par les vraies entrées (admin.log_action / admin-service) lors
// du câblage.

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

export const auditEntries: AuditEntry[] = [
  {
    id: "audit-1",
    timestampLabel: "08/07/2026 14:12",
    action: "Validation événement",
    entityType: "EVENT",
    entityLabel: "Festival Île de France",
    performedBy: "sophie.lambert@billetix.internal",
    reason: "Dossier conforme, justificatifs vérifiés",
  },
  {
    id: "audit-2",
    timestampLabel: "08/07/2026 09:47",
    action: "Suspension compte",
    entityType: "USER",
    entityLabel: "Karim Benali",
    performedBy: "sophie.lambert@billetix.internal",
    reason: "Signalements multiples pour billets non livrés",
  },
  {
    id: "audit-3",
    timestampLabel: "07/07/2026 22:03",
    action: "Alerte système",
    entityType: "PAYOUT",
    entityLabel: "PAY-2026-0231",
    performedBy: "system",
    reason: "Échec définitif de génération PDF après 5 tentatives",
  },
  {
    id: "audit-4",
    timestampLabel: "07/07/2026 16:30",
    action: "Remboursement",
    entityType: "ORDER",
    entityLabel: "ORD-2026-00389",
    performedBy: "sophie.lambert@billetix.internal",
    reason: "Doublon de commande confirmé par le support",
  },
  {
    id: "audit-5",
    timestampLabel: "06/07/2026 11:15",
    action: "Reversement effectué",
    entityType: "PAYOUT",
    entityLabel: "VIR-2026-1187",
    performedBy: "system",
    reason: "Virement SEPA automatique — délai J+2 respecté",
  },
  {
    id: "audit-6",
    timestampLabel: "05/07/2026 18:52",
    action: "Litige ouvert",
    entityType: "DISPUTE",
    entityLabel: "ORD-2026-00847",
    performedBy: "jean.dupont@email.com",
    reason: "Billet non reçu par email",
  },
  {
    id: "audit-7",
    timestampLabel: "04/07/2026 10:05",
    action: "Invalidation billet",
    entityType: "TICKET",
    entityLabel: "TKT-2026-3EFB8F",
    performedBy: "controle.entree@billetix.internal",
    reason: "Scan en double détecté à l'entrée",
  },
];

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
  EVENT: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30",
  ORDER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  TICKET: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  PAYMENT: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  PAYOUT: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  DISPUTE: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
};
