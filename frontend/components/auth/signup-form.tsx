"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { saveSession } from "@/lib/auth/session";

const accountTypes = [
  {
    id: "buyer",
    icon: "🎫",
    label: "Acheter des billets",
    description: "Accès au catalogue",
  },
  {
    id: "organizer",
    icon: "📢",
    label: "Organiser des événements",
    description: "Créer et vendre",
  },
] as const;

export function SignupForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"buyer" | "organizer">("buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const session = await registerUser({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: accountType === "organizer" ? "ORGANIZER" : "BUYER",
      });
      saveSession(session);
      setSuccess(true);
      setTimeout(() => router.push("/"), 1200);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de créer le compte, réessaie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-xl font-bold text-white">Compte créé !</h1>
        <p className="mt-2 text-sm text-violet-200/70">
          Vérifie ta boîte mail pour activer complètement ton compte.
          Redirection en cours…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          Créer un compte <span>✨</span>
        </h1>
        <p className="mt-1 text-sm text-violet-200/70">
          Rejoignez des milliers d&apos;utilisateurs BilleTiX
        </p>
      </div>

      <p className="mb-2 text-sm text-gray-400">Je veux…</p>
      <div className="mb-5 grid grid-cols-2 gap-3">
        {accountTypes.map((type) => {
          const isActive = type.id === accountType;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setAccountType(type.id)}
              className={
                isActive
                  ? "flex flex-col items-center gap-1.5 rounded-xl border border-violet-500 bg-violet-500/10 px-3 py-4 text-center"
                  : "flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center transition-colors hover:border-white/20"
              }
            >
              <span className="text-xl">{type.icon}</span>
              <span
                className={
                  isActive
                    ? "text-sm font-semibold text-violet-300"
                    : "text-sm font-semibold text-gray-200"
                }
              >
                {type.label}
              </span>
              <span className="text-xs text-gray-500">{type.description}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled
        title="Pas encore câblé — inscription email/mot de passe uniquement pour l'instant"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm font-medium text-gray-500 opacity-50"
      >
        <span className="font-bold">G</span>
        S&apos;inscrire avec Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-gray-500">ou</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Prénom
            </span>
            <input
              type="text"
              name="firstName"
              required
              placeholder="Jean"
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Nom
            </span>
            <input
              type="text"
              name="lastName"
              required
              placeholder="Dupont"
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="jean@email.com"
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
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Création du compte…" : "Créer mon compte →"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Déjà inscrit ?{" "}
        <Link
          href="/connexion"
          className="font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
