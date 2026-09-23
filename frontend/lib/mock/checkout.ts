// Données de démonstration pour le tunnel de commande — aucun appel API,
// à remplacer par le vrai récapitulatif (order-service / payment-service)
// lors du câblage.

export type CheckoutStepId =
  | "selection"
  | "identification"
  | "paiement"
  | "confirmation";

export interface CheckoutStep {
  id: CheckoutStepId;
  label: string;
}

export const checkoutSteps: CheckoutStep[] = [
  { id: "selection", label: "Sélection" },
  { id: "identification", label: "Identification" },
  { id: "paiement", label: "Paiement" },
  { id: "confirmation", label: "Confirmation" },
];

export interface OrderLine {
  label: string;
  amount: number;
}

export const mockOrderSummary = {
  lines: [
    { label: "2× Early Bird — Nuit Électronique", amount: 50.0 },
    { label: "Frais de service (10%)", amount: 5.0 },
    { label: "Frais Stripe", amount: 1.75 },
  ] satisfies OrderLine[],
  get total() {
    return this.lines.reduce((sum, line) => sum + line.amount, 0);
  },
};

export type PaymentMethodId =
  | "card"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "orange_money"
  | "wave";

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  glyph: string;
  glyphClassName: string;
}

export const paymentMethods: PaymentMethodOption[] = [
  {
    id: "card",
    label: "Carte bancaire",
    glyph: "💳",
    glyphClassName: "bg-sky-500/15 text-sky-300",
  },
  {
    id: "paypal",
    label: "PayPal",
    glyph: "P",
    glyphClassName: "bg-blue-600 text-white",
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    glyph: "🍎",
    glyphClassName: "bg-white/10 text-white",
  },
  {
    id: "google_pay",
    label: "Google Pay",
    glyph: "G",
    glyphClassName: "bg-blue-500 text-white",
  },
  {
    id: "orange_money",
    label: "Orange Money",
    glyph: "🟠",
    glyphClassName: "bg-white/10",
  },
  {
    id: "wave",
    label: "Wave",
    glyph: "🌊",
    glyphClassName: "bg-white/10",
  },
];
