// Données de démonstration pour les reversements — aucun appel API, à
// remplacer par les vraies données (payment-service) lors du câblage.

export type PayoutStatus = "pending" | "paid" | "blocked";

export interface AdminPayout {
  id: string;
  organizer: string;
  event: string;
  amountLabel: string;
  requestedLabel: string;
  status: PayoutStatus;
  note: string;
  grossLabel: string;
  commissionLabel: string;
  ibanLabel: string;
  reference?: string;
}

export const adminPayouts: AdminPayout[] = [
  {
    id: "payout-1",
    organizer: "Adama Diawara",
    event: "Nuit Électronique",
    amountLabel: "8 940 €",
    requestedLabel: "Demandé le 6 juillet 2026",
    status: "pending",
    note: "Délai J+2 respecté — prêt pour versement",
    grossLabel: "9 450 €",
    commissionLabel: "510 €",
    ibanLabel: "FR76 3000 6000 0112 3456 7890 189",
  },
  {
    id: "payout-2",
    organizer: "Marie Koné",
    event: "Soirée Jazz Club",
    amountLabel: "1 240 €",
    requestedLabel: "Demandé le 4 juillet 2026",
    status: "blocked",
    note: "Reversement anticipé refusé — événement terminé il y a 1j (J+2 requis)",
    grossLabel: "1 340 €",
    commissionLabel: "100 €",
    ibanLabel: "FR76 1670 6000 0112 9876 5432 110",
  },
  {
    id: "payout-3",
    organizer: "Paris Saint-Germain",
    event: "PSG vs Olympique Lyonnais",
    amountLabel: "612 400 €",
    requestedLabel: "Versé le 30 juin 2026",
    status: "paid",
    note: "Virement SEPA confirmé — réf. VIR-2026-1187",
    grossLabel: "648 000 €",
    commissionLabel: "35 600 €",
    ibanLabel: "FR76 3000 3000 0112 1122 3344 556",
    reference: "VIR-2026-1187",
  },
  {
    id: "payout-4",
    organizer: "Comédie-Française",
    event: "Roméo & Juliette",
    amountLabel: "15 680 €",
    requestedLabel: "Versé le 20 juin 2026",
    status: "paid",
    note: "Virement SEPA confirmé — réf. VIR-2026-1054",
    grossLabel: "16 546 €",
    commissionLabel: "866 €",
    ibanLabel: "FR76 3000 4000 0112 6677 8899 001",
    reference: "VIR-2026-1054",
  },
];

export const payoutStatusBadge: Record<
  PayoutStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "⏳ En attente",
    className:
      "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  paid: {
    label: "✓ Versé",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  blocked: {
    label: "⛔ Bloqué (J+2)",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
};

export const payoutStats: { label: string; value: string; valueClassName?: string }[] = [
  { label: "En attente", value: "8 940 €", valueClassName: "text-amber-400" },
  { label: "Versé ce mois", value: "628 080 €", valueClassName: "text-emerald-400" },
  { label: "Bloqués (délai J+2)", value: "1 240 €", valueClassName: "text-red-400" },
];

export const payoutStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "pending", label: "En attente" },
  { id: "paid", label: "Versés" },
  { id: "blocked", label: "Bloqués" },
];
