// Données de démonstration pour la page commissions — aucun appel API, à
// remplacer par les vraies valeurs de platform_settings (admin-service)
// lors du câblage.

export const commissionStats: {
  label: string;
  value: string;
  valueClassName?: string;
}[] = [
  { label: "Commissions ce mois", value: "9 840 €", valueClassName: "text-emerald-400" },
  { label: "Taux plateforme standard", value: "5,5 % + 0,30 €" },
  { label: "Événements exonérés (non lucratif)", value: "3" },
];

export interface FeeGridRow {
  id: string;
  provider: string;
  emoji: string;
  percent: string;
  fixed: string;
  note: string;
}

export const feeGrid: FeeGridRow[] = [
  {
    id: "card",
    provider: "Carte bancaire (Stripe)",
    emoji: "💳",
    percent: "5,5 %",
    fixed: "0,30 €",
    note: "Taux standard plateforme",
  },
  {
    id: "card-nonprofit",
    provider: "Carte bancaire — associations",
    emoji: "🤝",
    percent: "0 %",
    fixed: "0,00 €",
    note: "Exonération événements non lucratifs justifiés",
  },
  {
    id: "paypal",
    provider: "PayPal",
    emoji: "🅿️",
    percent: "5,5 %",
    fixed: "0,30 €",
    note: "Même barème que la carte bancaire",
  },
  {
    id: "orange-money",
    provider: "Orange Money",
    emoji: "🟠",
    percent: "2,5 %",
    fixed: "0,10 €",
    note: "Configurable via Paramètres",
  },
  {
    id: "wave",
    provider: "Wave",
    emoji: "🌊",
    percent: "1,8 %",
    fixed: "0,10 €",
    note: "Configurable via Paramètres",
  },
];
