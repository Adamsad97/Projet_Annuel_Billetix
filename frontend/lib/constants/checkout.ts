// Tunnel de commande : étapes et moyens de paiement proposés.

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
    glyphClassName: "bg-blue-600 text-ink-1",
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    glyph: "🍎",
    glyphClassName: "bg-hairline-2 text-ink-1",
  },
  {
    id: "google_pay",
    label: "Google Pay",
    glyph: "G",
    glyphClassName: "bg-blue-500 text-ink-1",
  },
  {
    id: "orange_money",
    label: "Orange Money",
    glyph: "🟠",
    glyphClassName: "bg-hairline-2",
  },
  {
    id: "wave",
    label: "Wave",
    glyph: "🌊",
    glyphClassName: "bg-hairline-2",
  },
];
