"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  getPayoutAccount,
  setPayoutMethod,
  updateIban,
  type ApiPayoutAccount,
  type PayoutMethod,
} from "@/lib/api/payout-account";
import { ApiError } from "@/lib/api/http-error";
import { reauthUrl } from "@/lib/auth/post-login";
import { longDateTime } from "@/lib/format/dates";
import {
  IBAN_LENGTHS,
  countryName,
  formatIban,
  ibanCaret,
  ibanCountries,
  ibanLength,
  ibanPlaceholder,
  withCountry,
} from "@/lib/format/iban";
import { Alert, FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";

const COUNTRIES = ibanCountries();
import { PasswordInput } from "@/components/ui/password-input";

const METHODS: Array<{ value: PayoutMethod; label: string; hint: string }> = [
  { value: "BANK_TRANSFER", label: "Virement sur mon IBAN", hint: "Viré par BilleTix après la date prévue de chaque événement." },
  { value: "STRIPE", label: "Stripe Connect", hint: "Versé automatiquement par Stripe sur le compte configuré chez Stripe." },
];

/** Compte de reversement : IBAN protégé par mot de passe ; un changement alerte par email et suspend les reversements. */
export function PayoutAccountSection() {
  const [account, setAccount] = useState<ApiPayoutAccount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [owner, setOwner] = useState("");
  const [iban, setIban] = useState("");
  // Pays du compte : fixe la longueur de l'IBAN (France par défaut).
  const [country, setCountry] = useState("FR");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Compte Google/Facebook : connexion trop ancienne pour modifier l'IBAN.
  const [reauthRequired, setReauthRequired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPayoutAccount()
      .then((result) => {
        if (cancelled) return;
        setAccount(result);
        setEditing(!result.has_iban);
        setOwner(result.bank_owner_name ?? "");
        const savedCountry = result.iban_masked?.slice(0, 2);
        if (savedCountry && IBAN_LENGTHS[savedCountry]) setCountry(savedCountry);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "Créez d'abord votre profil organisateur pour configurer vos reversements."
            : err instanceof ApiError
              ? err.message
              : "Impossible de charger votre compte de reversement.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setFormError(null);
    setReauthRequired(false);
    setNotice(null);
    try {
      const result = await updateIban({
        iban,
        bank_owner_name: owner,
        ...(account.has_password ? { current_password: password } : {}),
      });
      setAccount({
        ...account,
        has_iban: true,
        iban_masked: result.iban_masked,
        bank_owner_name: owner.trim(),
        payouts_held_until: result.payouts_held_until ?? account.payouts_held_until,
      });
      setNotice(
        result.changed
          ? "IBAN enregistré. Un email de confirmation vous a été envoyé."
          : "Titulaire du compte mis à jour.",
      );
      setEditing(false);
      setIban("");
      setPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        setReauthRequired(true);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Enregistrement impossible, veuillez réessayer.");
      }
    } finally {
      setSaving(false);
    }
  }

  /** Groupes de 4 pendant la frappe, curseur conservé (correction au milieu). */
  function handleIbanChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    let raw = input.value;
    let caret = input.selectionStart ?? raw.length;
    // Effacement d'un espace de séparation : on efface le caractère qui le précède.
    const compact = (value: string) => value.replace(/[^A-Za-z0-9]/g, "");
    if (raw.length < iban.length && compact(raw) === compact(iban) && caret > 0) {
      raw = raw.slice(0, caret - 1) + raw.slice(caret);
      caret -= 1;
    }
    // Saisie commencée par les chiffres : le code du pays choisi est ajouté devant.
    if (/^[0-9]/.test(compact(raw))) {
      raw = country + raw;
      caret += country.length;
    }
    // IBAN collé ou tapé avec un autre code pays : la liste suit.
    const typedCountry = compact(raw).slice(0, 2).toUpperCase();
    const nextCountry = IBAN_LENGTHS[typedCountry] ? typedCountry : country;
    const formatted = formatIban(raw, nextCountry);
    const nextCaret = ibanCaret(raw, caret, formatted);
    setCountry(nextCountry);
    setIban(formatted);
    requestAnimationFrame(() => input.setSelectionRange(nextCaret, nextCaret));
  }

  async function chooseMethod(method: PayoutMethod) {
    if (!account || method === account.payout_method) return;
    setSwitching(true);
    setMethodError(null);
    try {
      const updated = await setPayoutMethod(method);
      setAccount({ ...account, payout_method: updated.payout_method });
    } catch (err) {
      setMethodError(err instanceof ApiError ? err.message : "Changement impossible, veuillez réessayer.");
    } finally {
      setSwitching(false);
    }
  }

  const heldUntil = account?.payouts_held_until ? new Date(account.payouts_held_until) : null;

  return (
    <section className={cardClass("p-6")}>
      <h2 className="mb-4 text-lg font-bold text-ink-1">Compte de reversement</h2>

      {loadError ? (
        <p className="text-sm text-ink-5">{loadError}</p>
      ) : account === null ? (
        <p className="text-sm text-ink-5">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {heldUntil ? (
            <Alert tone="warning">
              Votre IBAN vient d&apos;être modifié : par sécurité, vos reversements sont suspendus jusqu&apos;au{" "}
              {longDateTime.format(heldUntil)}.
            </Alert>
          ) : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          {editing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-ink-4">
                Le produit de vos ventes vous est viré sur ce compte. Votre IBAN est chiffré et n&apos;est jamais
                affiché en entier.
              </p>
              {formError ? <FormError className="">{formError}</FormError> : null}
              {reauthRequired ? (
                <Alert tone="warning">
                  <p>
                    Votre connexion date de plus de {account.sensitive_action_reauth_minutes} minutes. Reconnectez-vous
                    avec Google ou Facebook : vous reviendrez ici pour enregistrer votre IBAN.
                  </p>
                  <a href={reauthUrl("/dashboard/paiements")} className={buttonClass("primary", "mt-3 inline-flex rounded-full px-4 py-2 text-sm")}>
                    Me reconnecter
                  </a>
                </Alert>
              ) : null}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                Titulaire du compte
                <input
                  required
                  minLength={2}
                  maxLength={140}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  autoComplete="name"
                  className={fieldClass("px-4 py-3")}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                Pays du compte
                <select
                  value={country}
                  onChange={(event) => {
                    const code = event.target.value;
                    setCountry(code);
                    setIban(withCountry(iban, code));
                  }}
                  className={fieldClass("px-4 py-3")}
                >
                  {COUNTRIES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                IBAN
                <input
                  required
                  value={iban}
                  onChange={handleIbanChange}
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder={ibanPlaceholder(country)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="iban-length"
                  className={fieldClass("px-4 py-3 font-mono")}
                />
                <IbanLengthHint value={iban} country={country} />
              </label>
              {account.has_password ? (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                  Mot de passe de votre compte
                  <PasswordInput
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className={fieldClass("px-4 py-3")}
                  />
                </label>
              ) : (
                <p className="text-xs text-ink-5">
                  Votre compte utilise une connexion Google ou Facebook : l&apos;IBAN ne peut être enregistré que
                  dans les {account.sensitive_action_reauth_minutes} minutes suivant votre connexion.{" "}
                  <a href={reauthUrl("/dashboard/paiements")} className="font-medium text-link hover:text-link-hover">
                    Me reconnecter maintenant
                  </a>
                </p>
              )}
              {account.has_iban ? (
                <p className="text-xs text-ink-5">
                  Après un changement d&apos;IBAN, vos reversements sont suspendus pendant{" "}
                  {account.iban_change_payout_hold_hours} heures et un email d&apos;alerte vous est envoyé.
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                {account.has_iban ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setFormError(null);
                      setIban("");
                      setPassword("");
                    }}
                    className={buttonClass("secondary", "rounded-full px-5 py-2.5 text-sm")}
                  >
                    Annuler
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className={buttonClass("primary", "rounded-full px-5 py-2.5 text-sm disabled:opacity-50")}
                >
                  {saving ? "Enregistrement…" : "Enregistrer mon IBAN"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-hairline-1 px-4 py-3 ring-1 ring-inset ring-hairline-2">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-xl">🏦</span>
                <div>
                  <p className="text-sm font-semibold text-ink-1">{account.bank_owner_name}</p>
                  <p className="font-mono text-xs text-ink-5">{account.iban_masked}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setEditing(true);
                }}
                className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
              >
                Modifier
              </button>
            </div>
          )}

          {account.has_iban ? (
            <fieldset className="flex flex-col gap-2" disabled={switching}>
              <legend className="mb-2 text-sm font-semibold text-ink-2">Moyen de reversement</legend>
              {METHODS.map((method) => {
                const unavailable = method.value === "STRIPE" && !account.stripe_connect_onboarded;
                return (
                  <label
                    key={method.value}
                    className={`flex items-start gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${
                      account.payout_method === method.value ? "bg-blue-500/5 ring-blue-500/40" : "ring-hairline-2"
                    } ${unavailable ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name="payout-method"
                      className="mt-1"
                      checked={account.payout_method === method.value}
                      disabled={unavailable}
                      onChange={() => chooseMethod(method.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink-1">{method.label}</span>
                      <span className="block text-xs text-ink-5">
                        {unavailable ? "Configurez d'abord votre compte Stripe ci-dessous." : method.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
              {methodError ? <FormError className="">{methodError}</FormError> : null}
            </fieldset>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** « IBAN France : 27 caractères — 21 / 27 », vert une fois la longueur atteinte. */
function IbanLengthHint({ value, country }: { value: string; country: string }) {
  const typedCountry = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
  const code = typedCountry.length === 2 && /^[A-Z]{2}$/.test(typedCountry) ? typedCountry : country;
  const expected = IBAN_LENGTHS[code];
  const typed = ibanLength(value);
  if (!expected) {
    return (
      <span id="iban-length" className="text-xs font-normal text-ink-5">
        Code pays « {code} » inconnu : vérifiez les 2 premières lettres de votre IBAN.
      </span>
    );
  }
  return (
    <span id="iban-length" className={`text-xs font-normal ${typed === expected ? "text-success" : "text-ink-5"}`}>
      IBAN {countryName(code)} : {expected} caractères — {typed} / {expected}
    </span>
  );
}
