"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { evaluatePassword } from "@/lib/auth/password-policy";
import { useRegistrationPolicy } from "@/lib/auth/use-registration-policy";

export function ResetPasswordForm({ token }: { token: string | null }) {
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
      setError("Lien invalide — le jeton de réinitialisation est manquant.");
      return;
    }

    if (!passwordValid) {
      setError("Le mot de passe ne respecte pas toutes les règles indiquées.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Réinitialisation impossible, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-ink-1">Mot de passe mis à jour</h1>
        <p className="mt-2 text-sm text-accent/70">
          Tu peux maintenant te connecter avec ton nouveau mot de passe.
        </p>
        <Link
          href="/connexion"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">
          Nouveau mot de passe <span>🔑</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">
          Choisis un nouveau mot de passe pour ton compte BilletiX.
        </p>
      </div>

      {!token ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          Ce lien est invalide ou incomplet — redemande un email depuis{" "}
          <Link href="/mot-de-passe-oublie" className="font-medium underline">
            mot de passe oublié
          </Link>
          .
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Nouveau mot de passe
          </span>
          <PasswordInput
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={`${minLength} caractères minimum`}
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Confirmer le mot de passe
          </span>
          <PasswordInput
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••••••"
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
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
          className="mt-1 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Réinitialisation…" : "Réinitialiser le mot de passe →"}
        </button>
      </form>
    </div>
  );
}
