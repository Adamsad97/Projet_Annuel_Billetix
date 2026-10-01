"use client";

import { FormEvent, useEffect, useState } from "react";
import { purchaseResale, type ApiResaleListing } from "@/lib/api/resale";
import { ApiError } from "@/lib/api/http-error";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";
import { BillingAddressFields } from "@/components/checkout/billing-address-fields";
import { euros as currency } from "@/lib/format/money";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

const fieldClassName = fieldClass("px-4 py-3");

export function ResaleBillingForm({
  listing,
  onOrderCreated,
}: {
  listing: ApiResaleListing;
  onOrderCreated: (orderId: string, clientSecret: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const result = await purchaseResale(listing.id, {
        billing_first_name: String(form.get("firstName") ?? ""),
        billing_last_name: String(form.get("lastName") ?? ""),
        billing_email: String(form.get("email") ?? ""),
        billing_address_line1: String(form.get("address1") ?? ""),
        billing_address_line2: String(form.get("address2") ?? "") || undefined,
        billing_city: String(form.get("city") ?? ""),
        billing_postal_code: String(form.get("postalCode") ?? ""),
        billing_country: String(form.get("country") ?? "FR"),
        payment_method: "STRIPE",
      });
      if (!result.client_secret) {
        setError(t("Impossible d'initialiser le paiement, veuillez réessayer."));
        return;
      }
      onOrderCreated(result.order_id, result.client_secret);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("Impossible de créer la commande, veuillez réessayer."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cardClass("p-5")}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-2">
        <span>👤</span>{t("Coordonnées de facturation")}</h2>

      <div className="mb-4 rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-4">
            {listing.event_name} — {listing.category_name}
          </span>
          <span className="font-bold text-ink-1">{currency.format(Number(listing.resale_price))}</span>
        </div>
      </div>

      {error ? (
        <FormError>
          {error}
        </FormError>
      ) : null}

      <form key={user ? user.id : "anon"} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Prénom")}</span>
            <input
              type="text"
              name="firstName"
              required
              defaultValue={user?.first_name ?? ""}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Nom")}</span>
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
          <span className="text-sm font-medium text-accent/80">{t("Email")}</span>
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
          className={buttonClass("primary", "mt-1 w-full rounded-full py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {loading ? t("Création de la commande…") : t("Continuer vers le paiement →")}
        </button>
      </form>
    </div>
  );
}
