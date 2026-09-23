"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Lien invalide — le jeton de réinitialisation est manquant.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

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
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-white">Mot de passe mis à jour</h1>
        <p className="mt-2 text-sm text-violet-200/70">
          Tu peux maintenant te connecter avec ton nouveau mot de passe.
        </p>
        <Link
          href="/connexion"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          Nouveau mot de passe <span>🔑</span>
        </h1>
        <p className="mt-1 text-sm text-violet-200/70">
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
          <span className="text-sm font-medium text-violet-200/80">
            Nouveau mot de passe
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="8 caractères minimum"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">
            Confirmer le mot de passe
          </span>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            placeholder="••••••••"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !token}
          className="mt-1 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Réinitialisation…" : "Réinitialiser le mot de passe →"}
        </button>
      </form>
    </div>
  );
}
