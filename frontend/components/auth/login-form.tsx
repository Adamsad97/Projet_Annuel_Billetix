"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { postLoginPath, rememberOAuthNext } from "@/lib/auth/post-login";
import { FormEvent, useEffect, useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import {
  expiredPasswordPath,
  getSessionPolicy,
  isAuthSession,
  isPasswordExpired,
  loginUser,
  requestMagicLink,
  resendVerificationEmail,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { saveSession } from "@/lib/auth/session";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

// Lien OAuth avec NEXT_PUBLIC_API_URL, identique côté serveur et navigateur (évite un hydration mismatch).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Après connexion : la page demandée (?next=) ou l'accueil, pour tous les rôles.
export function LoginForm({ sessionMessage, next }: { sessionMessage?: string; next?: string } = {}) {
  const router = useRouter();
  // Décoché par défaut : sur un ordinateur partagé ou prêté, la session ne
  // doit pas survivre à la fermeture du navigateur sans choix explicite.
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Renvoi du lien de vérification d'email (expiré ou jamais reçu).
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  // Étape 2FA : email et mot de passe retenus pour renvoyer le login avec le code.
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
    method: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Connexion par lien envoyé par email, proposée seulement si l'admin ne l'a pas désactivée.
  const [magicLinkEnabled, setMagicLinkEnabled] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionPolicy()
      .then((policy) => {
        if (!cancelled) setMagicLinkEnabled(policy.magic_link_enabled === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setLoading(true);
    try {
      await requestMagicLink(email);
      setMagicLinkSentTo(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Envoi impossible, veuillez réessayer."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setUnverifiedEmail(null);
    setResendStatus("idle");
    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      if (isAuthSession(result)) {
        saveSession(result, rememberMe);
        router.push(postLoginPath(next));
      } else if (isPasswordExpired(result)) {
        router.push(expiredPasswordPath(result));
      } else {
        setPendingCredentials({ email, password, method: result.two_factor_method });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.status === 403 && /non vérifiée/i.test(err.message)) {
          setUnverifiedEmail(email);
        }
      } else {
        setError(t("Connexion impossible, veuillez réessayer."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail) return;
    setResendStatus("sending");
    try {
      await resendVerificationEmail(unverifiedEmail);
      setResendStatus("sent");
    } catch {
      // L'endpoint ne révèle jamais d'échec métier (même pattern que
      // mot-de-passe-oublié) — un échec ici est réseau, pas fonctionnel.
      setResendStatus("idle");
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
        router.push(postLoginPath(next));
      } else if (isPasswordExpired(result)) {
        router.push(expiredPasswordPath(result));
      } else {
        setError(t("Code 2FA invalide."));
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("Vérification impossible, veuillez réessayer."),
      );
    } finally {
      setLoading(false);
    }
  }

  if (pendingCredentials) {
    return (
      <div className={cardClass("w-full max-w-md p-8")}>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Code de vérification")}</h1>
          <p className="mt-1 text-sm text-accent/70">{t("Entrez le code affiché dans votre application d'authentification ({method}).", { method: pendingCredentials.method })}</p>
        </div>

        {error ? (
          <FormError>
            {error}
          </FormError>
        ) : null}

        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
            placeholder={t("Code à 6 chiffres")}
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-center text-lg tracking-[0.3em] text-ink-1 placeholder:tracking-normal placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className={buttonClass("primary", "w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
          >
            {loading ? t("Vérification…") : t("Confirmer")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingCredentials(null);
              setTwoFactorCode("");
              setError(null);
            }}
            className="text-sm text-ink-5 hover:text-ink-3"
          >{t("← Revenir à la connexion")}</button>
        </form>
      </div>
    );
  }

  return (
    <div className={cardClass("w-full max-w-md p-8")}>
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">{t("Bienvenue")}{" "}<span>👋</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">{t("Connectez-vous à votre compte BilleTix")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Redirection pleine page : Passport doit afficher l'écran de consentement Google/Facebook. */}
        <a
          href={`${API_URL}/auth/google`}
          onClick={() => rememberOAuthNext(next)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">G</span>{t("Continuer avec Google")}</a>
        <a
          href={`${API_URL}/auth/facebook`}
          onClick={() => rememberOAuthNext(next)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">f</span>{t("Continuer avec Facebook")}</a>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline-2" />
        <span className="text-xs text-ink-5">{t("ou avec votre email")}</span>
        <div className="h-px flex-1 bg-hairline-2" />
      </div>

      {sessionMessage && !error ? (
        <div role="status" className="mb-4 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning ring-1 ring-inset ring-warning/30">
          {sessionMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
          {unverifiedEmail ? (
            <div className="mt-2">
              {resendStatus === "sent" ? (
                <span className="text-emerald-300">{t("✓ Email de vérification renvoyé — vérifiez votre boîte mail.")}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendStatus === "sending"}
                  className="font-medium text-accent underline transition-colors hover:text-accent disabled:opacity-60"
                >
                  {resendStatus === "sending" ? t("Envoi en cours…") : t("Renvoyer l'email de vérification")}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "magic" ? (
        magicLinkSentTo ? (
          <div role="status" className="rounded-xl bg-emerald-500/10 px-4 py-4 text-sm text-ink-2 ring-1 ring-inset ring-emerald-500/30">
            <p className="font-semibold text-ink-1">{t("Consultez votre boîte mail")}</p>
            <p className="mt-1">{t("Si un compte existe pour {email}, un lien de connexion vient de lui être envoyé. Il ne fonctionne qu'une fois et expire au bout de quelques minutes.", { email: magicLinkSentTo })}</p>
          </div>
        ) : (
          <form onSubmit={handleMagicLinkSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-ink-4">{t("Recevez par email un lien qui vous connecte sans mot de passe.")}</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Adresse email")}</span>
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="jean.dupont@email.com"
                className={fieldClass("px-4 py-3")}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className={buttonClass("primary", "w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
            >
              {loading ? t("Envoi en cours…") : t("Recevoir le lien de connexion")}
            </button>
          </form>
        )
      ) : null}

      {mode === "magic" ? (
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setMagicLinkSentTo(null);
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm font-medium text-link transition-colors hover:text-link-hover"
        >{t("← Se connecter avec le mot de passe")}</button>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" hidden={mode === "magic"}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Adresse email")}</span>
          <input
            type="email"
            name="email"
            required
            placeholder="jean.dupont@email.com"
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Mot de passe")}</span>
          <PasswordInput
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-4">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-hairline-4 bg-hairline-1 accent-blue-600"
            />{t("Se souvenir de moi")}</label>
          <Link
            href="/mot-de-passe-oublie"
            className="font-medium text-link transition-colors hover:text-link-hover"
          >{t("Mot de passe oublié ?")}</Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={buttonClass("primary", "mt-1 w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {loading ? t("Connexion…") : t("Se connecter →")}
        </button>

        {magicLinkEnabled ? (
          <button
            type="button"
            onClick={() => {
              setMode("magic");
              setError(null);
            }}
            className="w-full rounded-xl border border-hairline-2 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
          >{t("✉️ Recevoir un lien de connexion par email")}</button>
        ) : null}
      </form>

      <p className="mt-5 text-center text-sm text-ink-5">{t("Pas encore de compte ?")}{" "}
        <Link
          href="/inscription"
          className="font-medium text-link transition-colors hover:text-link-hover"
        >{t("S'inscrire gratuitement")}</Link>
      </p>
    </div>
  );
}
