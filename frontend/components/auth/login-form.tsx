"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { isAuthSession, loginUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { saveSession } from "@/lib/auth/session";

export function LoginForm() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 2FA : une fois requires_2fa reçu, on retient email/mot de passe
  // pour renvoyer le login complet avec le code TOTP sans redemander le
  // mot de passe à l'utilisateur.
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
    method: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      if (isAuthSession(result)) {
        saveSession(result, rememberMe);
        router.push("/");
      } else {
        setPendingCredentials({ email, password, method: result.two_factor_method });
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connexion impossible, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingCredentials) return;
    setError(null);
    setLoading(true);
    try {
      const result = await loginUser({
        email: pendingCredentials.email,
        password: pendingCredentials.password,
        two_factor_code: twoFactorCode,
      });
      if (isAuthSession(result)) {
        saveSession(result, rememberMe);
        router.push("/");
      } else {
        setError("Code 2FA invalide.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Vérification impossible, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (pendingCredentials) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Code de vérification</h1>
          <p className="mt-1 text-sm text-violet-200/70">
            Entre le code affiché dans ton application d&apos;authentification
            ({pendingCredentials.method}).
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
            placeholder="Code à 6 chiffres"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-lg tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Vérification…" : "Confirmer"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingCredentials(null);
              setTwoFactorCode("");
              setError(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            ← Revenir à la connexion
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          Bienvenue <span>👋</span>
        </h1>
        <p className="mt-1 text-sm text-violet-200/70">
          Connectez-vous à votre compte BilleTiX
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          title="Pas encore câblé — connexion email/mot de passe uniquement pour l'instant"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm font-medium text-gray-500 opacity-50"
        >
          <span className="font-bold">G</span>
          Continuer avec Google
        </button>
        <button
          type="button"
          disabled
          title="Pas encore câblé — connexion email/mot de passe uniquement pour l'instant"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm font-medium text-gray-500 opacity-50"
        >
          <span className="font-bold">f</span>
          Continuer avec Facebook
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-gray-500">ou avec votre email</span>
        <div className="h-px flex-1 bg-white/10" />
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
            name="email"
            required
            placeholder="jean.dupont@email.com"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">
            Mot de passe
          </span>
          <input
            type="password"
            name="password"
            required
            placeholder="••••••••"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-gray-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/[0.02] accent-violet-600"
            />
            Se souvenir de moi
          </label>
          <Link
            href="/mot-de-passe-oublie"
            className="font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter →"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          S&apos;inscrire gratuitement
        </Link>
      </p>
    </div>
  );
}
