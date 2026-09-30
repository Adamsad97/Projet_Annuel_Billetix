import { ForbiddenException } from "@nestjs/common";

/**
 * Rôles sans billets : un compte administrateur reste purement administratif,
 * un compte agent ne sert qu'au contrôle des entrées. Ni achat, ni revente,
 * ni billet reçu en cadeau.
 */
const NON_BUYER_ROLES: Record<string, string> = {
  ADMIN: "Un compte administrateur ne peut pas acheter de billets.",
  SUPER_ADMIN: "Un compte administrateur ne peut pas acheter de billets.",
  AGENT: "Un compte agent de contrôle ne peut pas acheter de billets.",
};

/** Refuse un achat (réservation, commande, revente) à un rôle sans billets. */
export function assertCanBuyTickets(role: string): void {
  const message = NON_BUYER_ROLES[role];
  if (message) throw new ForbiddenException(message);
}

/** Un compte de ce rôle peut-il détenir des billets (billet offert) ? */
export function canHoldTickets(role: string): boolean {
  return !(role in NON_BUYER_ROLES);
}
