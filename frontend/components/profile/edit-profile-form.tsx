"use client";

// Données réelles : identité du compte connecté (lecture seule) et adresse de
// facturation, enregistrée via PATCH /users/buyer/profile.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { getBuyerProfile, updateBuyerProfile, type BillingAddress } from "@/lib/api/buyer-profile";
import { ApiError } from "@/lib/api/http-error";
import { getStoredUser } from "@/lib/auth/session";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { fieldClass } from "@/components/ui/field";

const fieldClassName = fieldClass("px-4 py-3");
const readOnlyClassName = "rounded-xl border border-hairline-1 px-4 py-3 text-sm text-ink-4";

const ADDRESS_FIELDS: Array<{ key: keyof BillingAddress; label: string; placeholder?: string; wide?: boolean }> = [
  { key: "billing_address_line1", label: "Adresse", placeholder: "12 rue de la Paix", wide: true },
  { key: "billing_address_line2", label: "Complément d'adresse", placeholder: "Bâtiment, étage…", wide: true },
  { key: "billing_postal_code", label: "Code postal", placeholder: "75001" },
  { key: "billing_city", label: "Ville", placeholder: "Paris" },
  { key: "billing_country", label: "Pays", placeholder: "FR" },
];

export function EditProfileForm() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [address, setAddress] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session lue côté client uniquement
    setUser(getStoredUser());
    getBuyerProfile()
      .then((profile) =>
        setAddress(Object.fromEntries(ADDRESS_FIELDS.map(({ key }) => [key, profile[key] ?? ""]))),
      )
      .catch((err) =>
        setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Impossible de charger votre profil." }),
      );
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!address) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateBuyerProfile(Object.fromEntries(ADDRESS_FIELDS.map(({ key }) => [key, address[key].trim()])));
      setMessage({ kind: "success", text: "Votre adresse de facturation a été enregistrée." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "L'enregistrement a échoué." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className={cardClass("p-6")}>
      <div className="mb-6 flex items-center gap-4">
        <Avatar firstName={user?.first_name} lastName={user?.last_name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink-1">{user ? `${user.first_name} ${user.last_name}` : "…"}</p>
          <p className="truncate text-sm text-ink-5">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Prénom</span>
          <span className={readOnlyClassName}>{user?.first_name ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">Nom</span>
          <span className={readOnlyClassName}>{user?.last_name ?? "—"}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-5">
        Votre nom et votre email identifient vos billets : pour les modifier, contactez le support.
      </p>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-ink-2">Adresse de facturation</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ADDRESS_FIELDS.map(({ key, label, placeholder, wide }) => (
          <label key={key} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <span className="text-sm font-medium text-accent/80">{label}</span>
            <input
              type="text"
              value={address?.[key] ?? ""}
              placeholder={placeholder}
              disabled={address === null}
              onChange={(event) => setAddress((current) => (current ? { ...current, [key]: event.target.value } : current))}
              className={fieldClassName}
            />
          </label>
        ))}
      </div>

      {message ? (
        <p className={`mt-4 text-sm ${message.kind === "error" ? "text-danger" : "text-success"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={saving || address === null}
          className={buttonClass("primary", "flex-1 rounded-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/profil")}
          className={buttonClass("secondary", "flex-1 rounded-full py-3 text-sm")}
        >
          Retour
        </button>
      </div>
    </form>
  );
}
