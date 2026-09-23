// Données de démonstration pour les litiges — aucun appel API, à remplacer
// par les vraies données (payment-service / order-service) lors du câblage.

export type DisputeStatus = "open" | "in_progress" | "resolved" | "refunded";

export interface AdminDispute {
  id: string;
  orderRef: string;
  buyer: string;
  event: string;
  reason: string;
  amountLabel: string;
  status: DisputeStatus;
  openedLabel: string;
}

export const adminDisputes: AdminDispute[] = [
  {
    id: "dispute-1",
    orderRef: "ORD-2026-00847",
    buyer: "Jean Dupont",
    event: "PSG vs Olympique Lyonnais",
    reason: "Billet non reçu par email",
    amountLabel: "56,75 €",
    status: "open",
    openedLabel: "Ouvert il y a 6h",
  },
  {
    id: "dispute-2",
    orderRef: "ORD-2026-00701",
    buyer: "Léa Tran",
    event: "Nuit Électronique",
    reason: "Contestation bancaire (chargeback)",
    amountLabel: "35,00 €",
    status: "in_progress",
    openedLabel: "Ouvert il y a 1j",
  },
  {
    id: "dispute-3",
    orderRef: "ORD-2026-00512",
    buyer: "Karim Benali",
    event: "Roméo & Juliette",
    reason: "Événement annulé par l'organisateur",
    amountLabel: "18,00 €",
    status: "refunded",
    openedLabel: "Résolu le 25 juin 2026",
  },
  {
    id: "dispute-4",
    orderRef: "ORD-2026-00389",
    buyer: "Sophie Lambert",
    event: "Festival Île de France",
    reason: "Doublon de commande",
    amountLabel: "0,00 €",
    status: "resolved",
    openedLabel: "Résolu le 12 juin 2026",
  },
];

export const disputeStatusBadge: Record<
  DisputeStatus,
  { label: string; className: string }
> = {
  open: {
    label: "⚠️ Ouvert",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
  in_progress: {
    label: "● En cours",
    className:
      "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  resolved: {
    label: "✓ Résolu",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  refunded: {
    label: "✓ Remboursé",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
};

export const disputeStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "open", label: "Ouverts" },
  { id: "in_progress", label: "En cours" },
  { id: "resolved", label: "Résolus" },
  { id: "refunded", label: "Remboursés" },
];
