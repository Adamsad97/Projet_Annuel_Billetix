import { msg } from "@/lib/i18n/translate";
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
  { id: "selection", label: msg("Sélection") },
  { id: "identification", label: msg("Identification") },
  { id: "paiement", label: msg("Paiement") },
  { id: "confirmation", label: msg("Confirmation") },
];

export interface OrderLine {
  label: string;
  amount: number;
}
