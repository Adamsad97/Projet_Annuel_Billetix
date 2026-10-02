"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { evaluatePassword } from "@/lib/auth/password-policy";
import { useRegistrationPolicy } from "@/lib/auth/use-registration-policy";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

export function ResetPasswordForm({
  token,
  expiredAfterDays = null,
}: {
  token: string | null;
  /** Renseigné quand la connexion a exigé le changement (mot de passe trop ancien). */
  expiredAfterDays?: number | null;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { passwordMinLength: minLength } = useRegistrationPolicy();
  // Prénom/nom inconnus ici (lien email, pas de session) : cette règle-là
  // n'est vérifiée que par le serveur, qui renvoie alors un message clair.
  const passwordRules = evaluatePassword(password, minLength);
  const passwordValid = passwordRules.every((rule) => rule.ok);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError(t("Lien invalide — le jeton de réinitialisation est manquant."));
      return;
    }

    if (!passwordValid) {
      setError(t("Le mot de passe ne respecte pas toutes les règles indiquées."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Les mots de passe ne correspondent pas."));
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("Réinitialisation impossible, veuillez réessayer."),
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={cardClass("w-full max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-ink-1">{t("Mot de passe mis à jour")}</h1>
        <p className="mt-2 text-sm text-accent/70">{t("Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.")}</p>
        <Link
          href="/connexion"
          className={buttonClass("primary", "mt-6 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm")}
        >{t("Se connecter")}</Link>
      </div>
    );
  }

  return (
    <div className={cardClass("w-full max-w-md p-8")}>
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">
          {expiredAfterDays ? t("Votre mot de passe a expiré") : t("Nouveau mot de passe")}{" "}<span>🔑</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">{t("Choisissez un nouveau mot de passe pour votre compte BilleTix.")}</p>
      </div>

      {expiredAfterDays ? (
        <div role="status" className="mb-4 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning ring-1 ring-inset ring-warning/30">
          {t("Pour protéger votre compte, le mot de passe doit être renouvelé tous les {days} jours. Choisissez-en un différent de l'ancien ; ce lien n'est valable que quelques minutes.", { days: expiredAfterDays })}
        </div>
      ) : null}

      {!token ? (
        <FormError>{t("Ce lien est invalide ou incomplet — demandez un nouvel email depuis")}{" "}
          <Link href="/mot-de-passe-oublie" className="font-medium underline">{t("mot de passe oublié")}</Link>
          .
        </FormError>
      ) : null}

      {error ? (
        <FormError>
          {error}
        </FormError>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Nouveau mot de passe")}</span>
          <PasswordInput
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("{minLength} caractères minimum", { minLength })}
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Confirmer le mot de passe")}</span>
          <PasswordInput
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••••••"
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <PasswordRequirements
          rules={passwordRules}
          password={password}
          confirmPassword={confirmPassword}
        />

        <button
          type="submit"
          disabled={loading || !token || !passwordValid || password !== confirmPassword}
          className={buttonClass("primary", "mt-1 w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {loading ? t("Réinitialisation…") : t("Réinitialiser le mot de passe →")}
        </button>
      </form>
    </div>
  );
}
