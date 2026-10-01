import { ForbiddenException } from "@nestjs/common";

/** Rôles sans billets : admin et agent ne peuvent ni acheter, ni revendre, ni recevoir de billet. */
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
