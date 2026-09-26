"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { isAuthSession, loginUser, resendVerificationEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { saveSession } from "@/lib/auth/session";

// Bug corrigé (hydration mismatch) : getApiBaseUrl() choisit une adresse
// différente selon qu'elle est évaluée côté serveur (interne au réseau
// Docker, ex: http://api-gateway:4000) ou côté navigateur — correct pour un
// appel fetch (jamais rendu), mais ici la valeur est écrite dans un `href`
// affiché : React comparait deux HTML différents entre rendu serveur et
// navigateur. Un lien cliqué par le navigateur doit toujours pointer vers
// l'adresse navigateur, jamais l'adresse interne — NEXT_PUBLIC_API_URL est
// injectée en dur au build, identique des deux côtés.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Bug corrigé : la redirection post-connexion pointait toujours vers "/",
// qui rebondit aussitôt vers "/admin" pour un ADMIN/SUPER_ADMIN
// (BuyerOnlyGate) — un admin voyait donc un flash de la page d'accueil
// (le temps du fetch serveur des événements) avant d'être renvoyé au
// back-office. Redirige directement vers la bonne destination selon le rôle.
function postLoginPath(role: string, next?: string): string {
  // Bug corrigé : ?next= (posé par les pages réservées et le bouton
  // « Réserver ») était ignoré — retour systématique à l'accueil. Seuls les
  // chemins internes sont suivis (jamais "//domaine" : redirection ouverte).
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/connexion")) {
    return next;
  }
  return role === "ADMIN" || role === "SUPER_ADMIN" ? "/admin" : "/";
}

export function LoginForm({ sessionMessage, next }: { sessionMessage?: string; next?: string } = {}) {
  const router = useRouter();
  // Décoché par défaut : sur un ordinateur partagé ou prêté, la session ne
  // doit pas survivre à la fermeture du navigateur sans choix explicite.
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bug corrigé : /auth/resend-verification-email existait déjà côté
  // backend (nécessaire depuis que login() rejette les comptes non
  // vérifiés) mais n'était câblé nulle part côté frontend — un lien de
  // vérification expiré (24h) ou jamais reçu laissait le compte bloqué
  // sans recours visible pour l'utilisateur.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

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

    setUnverifiedEmail(null);
    setResendStatus("idle");
    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      if (isAuthSession(result)) {
        saveSession(result, rememberMe);
        router.push(postLoginPath(result.user.role, next));
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
        setError("Connexion impossible, veuillez réessayer.");
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
        router.push(postLoginPath(result.user.role, next));
      } else {
        setError("Code 2FA invalide.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Vérification impossible, veuillez réessayer.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (pendingCredentials) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink-1">Code de vérification</h1>
          <p className="mt-1 text-sm text-accent/70">
            Entrez le code affiché dans votre application d&apos;authentification
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
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-center text-lg tracking-[0.3em] text-ink-1 placeholder:tracking-normal placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="text-sm text-ink-5 hover:text-ink-3"
          >
            ← Revenir à la connexion
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-ink-1">
          Bienvenue <span>👋</span>
        </h1>
        <p className="mt-1 text-sm text-accent/70">
          Connectez-vous à votre compte BilleTiX
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Bug corrigé : redirection plein-page (pas un fetch) — Passport
            doit envoyer le navigateur sur l'écran de consentement Google/
            Facebook, une requête XHR ne le permettrait pas. */}
        <a
          href={`${API_URL}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">G</span>
          Continuer avec Google
        </a>
        <a
          href={`${API_URL}/auth/facebook`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-2 bg-hairline-1 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          <span className="font-bold">f</span>
          Continuer avec Facebook
        </a>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline-2" />
        <span className="text-xs text-ink-5">ou avec votre email</span>
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
                <span className="text-emerald-300">
                  ✓ Email de vérification renvoyé — vérifiez votre boîte mail.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendStatus === "sending"}
                  className="font-medium text-accent underline transition-colors hover:text-accent disabled:opacity-60"
                >
                  {resendStatus === "sending" ? "Envoi en cours…" : "Renvoyer l'email de vérification"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">
            Adresse email
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="jean.dupont@email.com"
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
            autoComplete="current-password"
            placeholder="••••••••"
            className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-4">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-hairline-4 bg-hairline-1 accent-blue-600"
            />
            Se souvenir de moi
          </label>
          <Link
            href="/mot-de-passe-oublie"
            className="font-medium text-link transition-colors hover:text-link-hover"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter →"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-5">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="font-medium text-link transition-colors hover:text-link-hover"
        >
          S&apos;inscrire gratuitement
        </Link>
      </p>
    </div>
  );
}
