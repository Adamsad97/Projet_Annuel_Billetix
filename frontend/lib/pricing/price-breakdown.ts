// Détail d'un prix de billet pour l'organisateur : ce que paie le client et
// ce qu'il percevra. Mêmes formules et mêmes arrondis que le serveur
// (order-service pour TVA et commission, api-gateway pour les frais de
// paiement) ; tous les taux viennent des réglages admin (PricingPolicy).

import type { PricingPolicy } from "@/lib/api/events";

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface PriceBreakdown {
  priceHt: number;
  vat: number;
  priceTtc: number;
  commissionPercent: number;
  commission: number;
  // Estimation : les frais réels dépendent du montant total de la commande
  // (part fixe par paiement), ici pour une commande d'un seul billet.
  paymentFees: number;
  // Billet gratuit : frais fixe à la charge de l'organisateur.
  freeTicketFee: number;
  organizerNet: number;
}

/** Commission applicable selon la capacité de l'événement (grand événement = taux réduit). */
export function commissionPercentFor(policy: PricingPolicy, totalCapacity: number): number {
  return totalCapacity > policy.large_event_threshold
    ? policy.commission_large_event_percent
    : policy.commission_standard_percent;
}

export function computePriceBreakdown(
  priceHt: number,
  policy: PricingPolicy,
  commissionPercent: number,
): PriceBreakdown {
  const ht = round2(Math.max(priceHt, 0));
  const priceTtc = round2(ht * (1 + policy.tva_rate));
  const isFree = ht === 0;
  const commission = round2(ht * (commissionPercent / 100));
  const paymentFees = isFree ? 0 : round2(priceTtc * (policy.stripe_fee_percent / 100) + policy.stripe_fee_fixed_eur);
  const freeTicketFee = isFree ? policy.free_ticket_fee_eur : 0;
  return {
    priceHt: ht,
    vat: round2(priceTtc - ht),
    priceTtc,
    commissionPercent,
    commission,
    paymentFees,
    freeTicketFee,
    organizerNet: round2(ht - commission - paymentFees - freeTicketFee),
  };
}
