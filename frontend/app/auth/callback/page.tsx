"use client";

// Bug corrigé (fonctionnalité cassée de bout en bout) : le callback OAuth
// backend redirige ici depuis toujours (googleCallback/facebookCallback,
// api-gateway), mais cette page n'a jamais existé côté frontend — un
// utilisateur complétant une connexion Google/Facebook tombait sur un 404,
// le code d'échange (Redis, usage unique, 60s) perdu pour rien.

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  completeOAuthBirthDate,
  exchangeOAuthCode,
  isOAuthPending2fa,
  isOAuthPendingBirthDate,
  verifyOAuth2fa,
  type OAuthExchangeResult,
} from "@/lib/api/auth";
import { ageInYears, underageMessage } from "@/lib/auth/age";
import { saveSession } from "@/lib/auth/session";
import { useRegistrationPolicy } from "@/lib/auth/use-registration-policy";
import { ApiError } from "@/lib/api/http-error";

// Bug corrigé : même correctif que login-form.tsx — "/" rebondit aussitôt
// vers "/admin" pour un ADMIN/SUPER_ADMIN (BuyerOnlyGate).
function postLoginPath(role: string): string {
  return role === "ADMIN" || role === "SUPER_ADMIN" ? "/admin" : "/";
}

// Bug corrigé : useSearchParams() hors <Suspense> faisait échouer
// `next build` (prérendu impossible) — invisible en `next dev`.
export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackContent />
    </Suspense>
  );
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = useState<"loading" | "error" | "needs_birth_date" | "needs_2fa">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string>("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const { minimumAge } = useRegistrationPolicy();
  // Affiché dès la saisie : un mineur sait tout de suite pourquoi il ne
  // pourra pas continuer (le serveur refuse de toute façon, sans créer de
  // compte).
  const underage = birthDate !== "" && ageInYears(birthDate) < minimumAge;

  // Étape suivante selon la réponse du serveur : date de naissance (première
  // connexion), code 2FA, ou session ouverte.
  function handleResult(result: OAuthExchangeResult) {
    if (isOAuthPendingBirthDate(result)) {
      setPendingToken(result.pending_token);
      setFirstName(result.first_name);
      setStatus("needs_birth_date");
      return;
    }
    if (isOAuthPending2fa(result)) {
      setPendingToken(result.pending_token);
      setTwoFactorMethod(result.two_factor_method);
      setStatus("needs_2fa");
      return;
    }
    // Session limitée à l'onglet, comme la connexion classique sans « Se
    // souvenir de moi » (décochée par défaut) : pas de choix proposé ici.
    saveSession(result, false);
    router.push(postLoginPath(result.user.role));
  }

  useEffect(() => {
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError("Lien de connexion invalide — le code est manquant.");
      return;
    }

    exchangeOAuthCode(code)
      .then(handleResult)
      .catch((err) => {
        setStatus("error");
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de finaliser la connexion, veuillez réessayer.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleBirthDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingToken || underage) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await completeOAuthBirthDate(pendingToken, birthDate);
      setVerifying(false);
      handleResult(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de finaliser la connexion, veuillez réessayer.",
      );
      setVerifying(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingToken) return;
    setVerifying(true);
    setError(null);
    try {
      const session = await verifyOAuth2fa(pendingToken, twoFactorCode);
      saveSession(session, false);
      router.push(postLoginPath(session.user.role));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Code invalide, veuillez réessayer.",
      );
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-page px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8">
        {status === "loading" ? (
          <p className="text-center text-sm text-ink-5">Connexion en cours…</p>
        ) : status === "error" ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-ink-1">Connexion impossible</h1>
            </div>
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
              {error}
            </p>
            <Link
              href="/connexion"
              className="mt-6 block rounded-full bg-blue-700 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
            >
              Retour à la connexion
            </Link>
          </>
        ) : status === "needs_birth_date" ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-ink-1">
                {firstName ? `Bienvenue ${firstName} !` : "Bienvenue !"}
              </h1>
              <p className="mt-1 text-sm text-accent/70">
                Une dernière étape : indiquez votre date de naissance. BilletiX est
                réservé aux personnes d&apos;au moins {minimumAge} ans.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-inset ring-danger/30">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleBirthDate} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-accent/80">Date de naissance</span>
                <input
                  type="date"
                  required
                  autoFocus
                  max={new Date().toISOString().slice(0, 10)}
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  aria-invalid={underage}
                  aria-describedby={underage ? "underage-message" : undefined}
                  className={`rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none ${underage ? "border-danger" : ""}`}
                />
              </label>
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
              <button
                type="submit"
                disabled={verifying || underage || birthDate === ""}
                className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Vérification…" : "Continuer →"}
              </button>
            </form>
            <Link
              href="/connexion"
              className="mt-4 block text-center text-sm text-ink-5 transition-colors hover:text-ink-2"
            >
              Annuler
            </Link>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-ink-1">Code de vérification</h1>
              <p className="mt-1 text-sm text-accent/70">
                Entrez le code affiché dans votre application d&apos;authentification
                ({twoFactorMethod}).
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleVerify} className="flex flex-col gap-4">
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
                disabled={verifying}
                className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Vérification…" : "Confirmer"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
