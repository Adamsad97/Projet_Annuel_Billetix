// Tunnel de commande : étapes et lignes du récapitulatif.

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
