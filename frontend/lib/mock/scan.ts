// Données de démonstration pour la console de scan — aucun appel API, à
// remplacer par le vrai scan (ticket-service, POST /tickets/scan) lors du
// câblage.

export type ScanOutcome = "valid" | "already_used" | "invalid";

export interface ScannableTicket {
  reference: string;
  holderName: string;
  category: string;
  outcome: ScanOutcome;
}

export const currentScanEvent = {
  name: "Nuit Électronique",
  dateLabel: "15 août 2026 · La Défense Arena",
};

// Billets connus pour la simulation (saisie manuelle ou scan aléatoire).
export const knownTickets: ScannableTicket[] = [
  { reference: "TKT-2026-3EFB8F", holderName: "Adama Diawara", category: "Standard", outcome: "valid" },
  { reference: "TKT-2026-A06067", holderName: "Léa Tran", category: "VIP", outcome: "valid" },
  { reference: "TKT-2026-B9E553", holderName: "Karim Benali", category: "Standard", outcome: "already_used" },
  { reference: "TKT-2026-2D12EF", holderName: "Sophie Lambert", category: "Early Bird", outcome: "already_used" },
];

export const scanOutcomeStyles: Record<
  ScanOutcome,
  { label: string; className: string; icon: string }
> = {
  valid: {
    label: "Billet valide",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    icon: "✓",
  },
  already_used: {
    label: "Déjà scanné",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    icon: "⚠️",
  },
  invalid: {
    label: "Billet invalide",
    className: "bg-red-500/15 text-red-300 ring-red-500/30",
    icon: "✕",
  },
};
