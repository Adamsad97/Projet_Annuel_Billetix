"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      // Réponse volontairement identique que le compte existe ou non
      // (le backend ne révèle jamais si un email est enregistré).
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'envoyer l'email, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-white">Email envoyé</h1>
        <p className="mt-2 text-sm text-violet-200/70">
          Si un compte existe pour <span className="text-white">{email}</span>
          , un lien de réinitialisation vient de lui être envoyé.
        </p>

        <Link
          href="/connexion"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          Retour à la connexion
        </Link>

        <p className="mt-4 text-sm text-gray-500">
          Rien reçu ?{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            Renvoyer le lien
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          Mot de passe oublié <span>🔑</span>
        </h1>
        <p className="mt-1 text-sm text-violet-200/70">
          Entrez votre email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">
            Adresse email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jean.dupont@email.com"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Envoi…" : "Envoyer le lien →"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        <Link
          href="/connexion"
          className="font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
