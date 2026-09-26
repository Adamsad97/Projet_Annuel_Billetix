"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Cart } from "@/lib/checkout/cart";
import { cartTotal, cartVat } from "@/lib/checkout/cart";
import { createOrder, type CreateOrderPayload } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";
import { BillingAddressFields } from "@/components/checkout/billing-address-fields";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const fieldClassName =
  "rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

export function BillingForm({
  cart,
  onOrderCreated,
  onReservationExpired,
}: {
  cart: Cart;
  onOrderCreated: (orderId: string) => void;
  /** Refus 410 du serveur : réservation expirée entre-temps. */
  onReservationExpired?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // Pré-remplit avec les coordonnées du compte connecté (reste modifiable
    // — bug signalé : sans ça, une valeur mémorisée par l'autocomplétion du
    // navigateur pouvait être envoyée par erreur à la place). Lu en effet
    // (plutôt qu'en initialiseur) pour rester cohérent avec le HTML serveur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload: CreateOrderPayload = {
      event_id: cart.eventId,
      reservation_token: cart.reservationToken,
      items: cart.lines.map((line) => ({
        ticket_category_id: line.ticketCategoryId,
        quantity: line.quantity,
      })),
      billing_first_name: String(form.get("firstName") ?? ""),
      billing_last_name: String(form.get("lastName") ?? ""),
      billing_email: String(form.get("email") ?? ""),
      billing_address_line1: String(form.get("address1") ?? ""),
      billing_address_line2: String(form.get("address2") ?? "") || undefined,
      billing_city: String(form.get("city") ?? ""),
      billing_postal_code: String(form.get("postalCode") ?? ""),
      billing_country: String(form.get("country") ?? "FR"),
      payment_method: "STRIPE",
    };

    setLoading(true);
    try {
      const { order } = await createOrder(payload);
      onOrderCreated(order.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410 && onReservationExpired) {
        onReservationExpired();
        return;
      }
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer la commande, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline-1 bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-2">
        <span>👤</span>
        Coordonnées de facturation
      </h2>

      <div className="mb-4 rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-4">{cart.eventTitle}</span>
          <span className="font-bold text-ink-1">{currency.format(cartTotal(cart))}</span>
        </div>
        {cartTotal(cart) > 0 && cartVat(cart) !== null ? (
          <p className="mt-1 text-right text-xs text-ink-5">TTC, dont TVA {currency.format(cartVat(cart) ?? 0)}</p>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      ) : null}

      <form
        key={user ? user.id : "anon"}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">Prénom</span>
            <input
              type="text"
              name="firstName"
              required
              defaultValue={user?.first_name ?? ""}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">Nom</span>
            <input
              type="text"
              name="lastName"
              required
              defaultValue={user?.last_name ?? ""}
              className={fieldClassName}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Email</span>
          <input
            type="email"
            name="email"
            required
            defaultValue={user?.email ?? ""}
            className={fieldClassName}
          />
        </label>

        <BillingAddressFields fieldClassName={fieldClassName} />

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-full bg-blue-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Création de la commande…" : "Continuer vers le paiement →"}
        </button>
      </form>
    </div>
  );
}
