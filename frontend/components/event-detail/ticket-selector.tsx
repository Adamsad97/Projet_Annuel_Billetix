"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TicketOption } from "@/lib/mock/event-details";
import { reserveStock } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { saveCart } from "@/lib/checkout/cart";
import { getAccessToken, getStoredUser } from "@/lib/auth/session";

const currency = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function TicketSelector({
  eventId,
  eventTitle,
  tickets,
  organizerId,
}: {
  eventId: string;
  eventTitle: string;
  tickets: TicketOption[];
  organizerId: string;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, t.defaultQuantity ?? 0])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bug corrigé : le backend refuse déjà qu'un organisateur achète un
  // billet pour son propre événement (order.service.ts create()), mais la
  // page publique proposait quand même le formulaire d'achat — l'erreur
  // n'arrivait qu'après réservation + saisie de facturation, beaucoup
  // trop tard. Lu en useEffect (comme partout ailleurs dans l'app) : le
  // compte connecté vit dans le localStorage, absent côté serveur.
  const [isOwnEvent, setIsOwnEvent] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOwnEvent(getStoredUser()?.id === organizerId);
  }, [organizerId]);

  const total = useMemo(
    () =>
      tickets.reduce(
        (sum, ticket) => sum + ticket.price * (quantities[ticket.id] ?? 0),
        0,
      ),
    [tickets, quantities],
  );

  // Distinct de `total` : un événement gratuit a toujours total === 0 même
  // avec des billets sélectionnés — utiliser `total === 0` pour désactiver
  // le bouton (bug corrigé) rendait la réservation impossible pour tout
  // événement gratuit, quelle que soit la quantité choisie.
  const selectedCount = useMemo(
    () => Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities],
  );

  function updateQuantity(id: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  async function handleReserve() {
    setError(null);

    if (!getAccessToken()) {
      router.push(`/connexion?next=/evenements/${eventId}`);
      return;
    }

    const items = tickets
      .filter((t) => (quantities[t.id] ?? 0) > 0)
      .map((t) => ({ ticket_category_id: t.id, quantity: quantities[t.id] }));

    if (items.length === 0) return;

    setLoading(true);
    try {
      const reservation = await reserveStock(eventId, items);
      saveCart({
        eventId,
        eventTitle,
        reservationToken: reservation.reservation_token,
        expiresAt: reservation.expires_at,
        lines: tickets
          .filter((t) => (quantities[t.id] ?? 0) > 0)
          .map((t) => ({
            ticketCategoryId: t.id,
            label: t.label,
            unitPrice: t.price,
            quantity: quantities[t.id],
          })),
      });
      router.push("/commande");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Réservation impossible, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (isOwnEvent) {
    return (
      <div className="sticky top-24 rounded-2xl border border-white/5 bg-[#12101c] p-5">
        <h2 className="text-base font-bold text-white">Choisir mes billets</h2>
        <p className="mt-4 text-sm text-gray-400">
          C&apos;est ton événement — un organisateur ne peut pas acheter de billet pour son propre
          événement.
        </p>
        <Link
          href={`/dashboard/evenements/${eventId}`}
          className="mt-4 block rounded-full border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
        >
          Gérer cet événement →
        </Link>
      </div>
    );
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <h2 className="text-base font-bold text-white">Choisir mes billets</h2>

      {tickets.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Aucune catégorie de billet disponible pour le moment.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {ticket.label}
                  </span>
                  {ticket.tag ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      {ticket.tag}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  {ticket.originalPrice ? (
                    <span className="text-xs text-gray-500 line-through">
                      {ticket.originalPrice} €
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold text-violet-300">
                    {ticket.price} €
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(ticket.id, -1)}
                  aria-label={`Retirer un billet ${ticket.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-medium text-white">
                  {quantities[ticket.id] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(ticket.id, 1)}
                  aria-label={`Ajouter un billet ${ticket.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-sm text-gray-400">Total estimé</span>
        <span className="text-lg font-bold text-white">
          {currency.format(total)}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={selectedCount === 0 || loading}
        onClick={handleReserve}
        className="mt-4 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Réservation…" : "Réserver mes billets →"}
      </button>

      <p className="mt-3 text-center text-xs text-gray-500">
        🔒 QR code unique envoyé sous 5 min
      </p>
    </div>
  );
}
