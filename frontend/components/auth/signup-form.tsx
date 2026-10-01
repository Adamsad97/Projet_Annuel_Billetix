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
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t, msg } from "@/lib/i18n/translate";

// Même lien OAuth que la connexion (NEXT_PUBLIC_API_URL, identique serveur et navigateur).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const accountTypes = [
  {
    id: "buyer",
    icon: "🎫",
    label: msg("Acheter des billets"),
    description: msg("Accès aux événements"),
  },
  {
    id: "organizer",
    icon: "📢",
    label: msg("Organiser des événements"),
    description: msg("Créer et vendre"),
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
      setError(t("Le mot de passe ne respecte pas toutes les règles indiquées."));
      return;
    }
    if (containsPersonalInfo(password, { firstName, lastName, birthDate })) {
      setError(t(PERSONAL_INFO_ERROR));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Les mots de passe ne correspondent pas."));
      return;
    }

    setLoading(true);
    try {
      // Pas de session à l'inscription : l'accès passe par la connexion une fois l'email vérifié.
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
          : t("Impossible de créer le compte, veuillez réessayer."),
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={cardClass("w-full max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-xl font-bold text-ink-1">{t("Compte créé !")}</h1>
        <p className="mt-2 text-sm text-accent/70">{t("Cliquez sur le lien reçu par email pour activer votre compte, puis connectez-vous — l'accès n'est possible qu'une fois l'adresse vérifiée.")}</p>
        <Link
          href="/connexion"
          className={buttonClass("primary", "mt-5 inline-block rounded-full px-5 py-2.5 text-sm")}
        >{t("Aller à la connexion →")}</Link>
      </div>
    );
  }

  return (
    <div className={cardClass("w-full max-w-md p-8")}>
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">{t("Créer un compte")}{" "}<span>✨</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">{t("Retrouvez vos billets et vos commandes au même endroit.")}</p>
      </div>

      <p className="mb-2 text-sm text-ink-4">{t("Je veux…")}</p>
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
                {t(type.label)}
              </span>
              <span className="text-xs text-ink-5">{t(type.description)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={`${API_URL}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">G</span>{t("S'inscrire avec Google")}</a>
        <a
          href={`${API_URL}/auth/facebook`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">f</span>{t("S'inscrire avec Facebook")}</a>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline-2" />
        <span className="text-xs text-ink-5">ou</span>
        <div className="h-px flex-1 bg-hairline-2" />
      </div>

      {error ? (
        <FormError>
          {error}
        </FormError>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Prénom")}</span>
            <input
              type="text"
              name="firstName"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder={t("Jean")}
              className={fieldClass("px-4 py-3")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Nom")}</span>
            <input
              type="text"
              name="lastName"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder={t("Dupont")}
              className={fieldClass("px-4 py-3")}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Date de naissance")}</span>
          <input
            type="date"
            name="birthDate"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            aria-invalid={underage}
            aria-describedby={underage ? "underage-message" : undefined}
            className={fieldClass(`px-4 py-3 ${underage ? "border-danger" : ""}`)}
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
          <span className="text-sm font-medium text-accent/80">{t("Email")}</span>
          <input
            type="email"
            name="email"
            required
            placeholder="jean@email.com"
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Mot de passe")}</span>
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
          disabled={loading || underage || !passwordValid || password !== confirmPassword}
          className={buttonClass("primary", "mt-1 w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {loading ? t("Création du compte…") : t("Créer mon compte →")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-5">{t("Déjà inscrit ?")}{" "}
        <Link
          href="/connexion"
          className="font-medium text-link transition-colors hover:text-link-hover"
        >{t("Se connecter")}</Link>
      </p>
    </div>
  );
}
