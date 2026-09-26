// État du panier en cours entre la page événement (réservation du stock) et
// le tunnel de commande — sessionStorage plutôt qu'un store global : léger,
// effacé si l'onglet se ferme (cohérent avec le TTL de réservation côté
// serveur, quelques minutes).

const CART_KEY = "billetix_cart";

export interface CartLine {
  ticketCategoryId: string;
  label: string;
  // Prix TTC unitaire (affiché et payé) ; HT pour le détail « dont TVA ».
  unitPrice: number;
  unitPriceHt?: number;
  quantity: number;
}

export interface Cart {
  eventId: string;
  eventTitle: string;
  reservationToken: string;
  expiresAt: string;
  lines: CartLine[];
}

export function saveCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getCart(): Cart | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CART_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    return null;
  }
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CART_KEY);
}

export function cartTotal(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

/** TVA incluse dans le total, ou null si le détail HT n'est pas connu. */
export function cartVat(cart: Cart): number | null {
  if (cart.lines.some((line) => line.unitPriceHt === undefined)) return null;
  const vat = cart.lines.reduce((sum, line) => sum + (line.unitPrice - (line.unitPriceHt ?? 0)) * line.quantity, 0);
  return Math.round(vat * 100) / 100;
}
