"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { PasswordInput } from "@/components/ui/password-input";
import { registerUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import {
  containsPersonalInfo,
  evaluatePassword,
  PERSONAL_INFO_ERROR,
} from "@/lib/auth/password-policy";
import { ageInYears, underageMessage } from "@/lib/auth/age";
import { useRegistrationPolicy } from "@/lib/auth/use-registration-policy";

// Même mécanisme que login-form.tsx : oauthLogin() (auth-service) crée le
// compte s'il n'existe pas déjà — inscription et connexion partagent le
// même point d'entrée, donc le même lien. NEXT_PUBLIC_API_URL (pas
// getApiBaseUrl(), qui varie entre rendu serveur et navigateur) : un href
// affiché doit être identique des deux côtés, sinon React refuse
// l'hydratation (déjà rencontré sur le formulaire de connexion).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  const [accountType, setAccountType] = useState<"buyer" | "organizer">("buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Contrôlés (et non lus via FormData) pour vérifier les règles du mot de
  // passe à chaque frappe (prénom et nom, eux, seulement à l'envoi).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { passwordMinLength: minLength, minimumAge } = useRegistrationPolicy();
  // Affiché dès la saisie de la date (pas seulement à l'envoi) : inutile de
  // laisser un mineur remplir tout le formulaire pour rien.
  const underage = birthDate !== "" && ageInYears(birthDate) < minimumAge;
  const passwordRules = evaluatePassword(password, minLength);
  const passwordValid = passwordRules.every((rule) => rule.ok);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    if (underage) {
      setError(underageMessage(minimumAge));
      return;
    }
    if (!passwordValid) {
      setError("Le mot de passe ne respecte pas toutes les règles indiquées.");
      return;
    }
    if (containsPersonalInfo(password, { firstName, lastName, birthDate })) {
      setError(PERSONAL_INFO_ERROR);
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      // Bug corrigé : register() connectait aussitôt (session complète
      // sauvegardée ici), en contradiction avec login() qui rejette tout
      // compte non vérifié (CDC §2.2) — accès complet à l'inscription, puis
      // blocage à la prochaine connexion pour ce même compte jamais
      // vérifié entretemps. Plus de session à sauvegarder : l'accès réel
      // passe par la page de connexion, une fois le lien reçu par email cliqué.
      await registerUser({
        email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        role: accountType === "organizer" ? "ORGANIZER" : "BUYER",
      });
      setSuccess(true);
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
      <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-xl font-bold text-ink-1">Compte créé !</h1>
        <p className="mt-2 text-sm text-accent/70">
          Clique sur le lien reçu par email pour activer ton compte, puis
          connecte-toi — l&apos;accès n&apos;est possible qu&apos;une fois l&apos;adresse vérifiée.
        </p>
        <Link
          href="/connexion"
          className="mt-5 inline-block rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
        >
          Aller à la connexion →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">
          Créer un compte <span>✨</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">
          Rejoignez des milliers d&apos;utilisateurs BilleTiX
        </p>
      </div>

      <p className="mb-2 text-sm text-ink-4">Je veux…</p>
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
                  ? "flex flex-col items-center gap-1.5 rounded-xl border border-blue-500 bg-blue-500/10 px-3 py-4 text-center"
                  : "flex flex-col items-center gap-1.5 rounded-xl border border-hairline-2 bg-hairline-1 px-3 py-4 text-center transition-colors hover:border-hairline-4"
              }
            >
              <span className="text-xl">{type.icon}</span>
              <span
                className={
                  isActive
                    ? "text-sm font-semibold text-accent"
                    : "text-sm font-semibold text-ink-2"
                }
              >
                {type.label}
              </span>
              <span className="text-xs text-ink-5">{type.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={`${API_URL}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">G</span>
          S&apos;inscrire avec Google
        </a>
        <a
          href={`${API_URL}/auth/facebook`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">f</span>
          S&apos;inscrire avec Facebook
        </a>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline-2" />
        <span className="text-xs text-ink-5">ou</span>
        <div className="h-px flex-1 bg-hairline-2" />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">
              Prénom
            </span>
            <input
              type="text"
              name="firstName"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Jean"
              className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">
              Nom
            </span>
            <input
              type="text"
              name="lastName"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Dupont"
              className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Date de naissance
          </span>
          <input
            type="date"
            name="birthDate"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            aria-invalid={underage}
            aria-describedby={underage ? "underage-message" : undefined}
            className={`rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none ${underage ? "border-danger" : ""}`}
          />
          {underage ? (
            <p
              id="underage-message"
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger ring-1 ring-inset ring-danger/30"
            >
              <span aria-hidden="true">⛔</span>
              {underageMessage(minimumAge)}
            </p>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="jean@email.com"
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Mot de passe
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
          disabled={loading || underage || !passwordValid || password !== confirmPassword}
          className="mt-1 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Création du compte…" : "Créer mon compte →"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-5">
        Déjà inscrit ?{" "}
        <Link
          href="/connexion"
          className="font-medium text-link transition-colors hover:text-link-hover"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
