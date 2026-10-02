"use client";

// Lien de connexion reçu par email. Connexion seulement au clic : les antivirus de messagerie ouvrent les liens
// à l'avance et consommeraient sinon ce lien à usage unique avant l'utilisateur.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyMagicLink, verifyOAuth2fa, type AuthSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { saveSession } from "@/lib/auth/session";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

export function MagicLinkLogin({ token }: { token: string | null }) {
  const router = useRouter();

  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending2fa, setPending2fa] = useState<{ token: string; method: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  function openSession(session: AuthSession) {
    saveSession(session, rememberMe);
    router.push("/");
  }

  async function handleLogin() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyMagicLink(token);
      if ("requires_2fa" in result) {
        setPending2fa({ token: result.pending_token, method: result.two_factor_method });
      } else {
        openSession(result);
        return;
      }
    } catch (err) {
      setFailed(true);
      setError(err instanceof ApiError ? err.message : t("Connexion impossible, veuillez réessayer."));
    }
    setLoading(false);
  }

  async function handleTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending2fa) return;
    setError(null);
    setLoading(true);
    try {
      openSession(await verifyOAuth2fa(pending2fa.token, twoFactorCode));
      return;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Code invalide, veuillez réessayer."));
    }
    setLoading(false);
  }

  if (!token || failed) {
    return (
      <div className={cardClass("w-full max-w-md p-8 text-center")}>
        <h1 className="text-2xl font-bold text-ink-1">{t("Lien de connexion inutilisable")}</h1>
        <p className="mt-2 text-sm text-ink-4">
          {error ?? t("Ce lien est incomplet. Veuillez en demander un nouveau depuis la page de connexion.")}
        </p>
        <Link
          href="/connexion"
          className={buttonClass("primary", "mt-6 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm")}
        >{t("Demander un nouveau lien")}</Link>
      </div>
    );
  }

  if (pending2fa) {
    return (
      <div className={cardClass("w-full max-w-md p-8")}>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Code de vérification")}</h1>
          <p className="mt-1 text-sm text-accent/70">{t("Entrez le code affiché dans votre application d'authentification ({method}).", { method: pending2fa.method })}</p>
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <form onSubmit={handleTwoFactor} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
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
        </form>
      </div>
    );
  }

  return (
    <div className={cardClass("w-full max-w-md p-8 text-center")}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-hairline-1 text-2xl" aria-hidden="true">
        ✉️
      </div>
      <h1 className="text-2xl font-bold text-ink-1">{t("Connexion à BilleTix")}</h1>
      <p className="mt-2 text-sm text-ink-4">{t("Cliquez sur le bouton ci-dessous pour ouvrir votre session. Ce lien ne fonctionne qu'une seule fois.")}</p>

      <label className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-4">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 rounded border-hairline-4 bg-hairline-1 accent-blue-600"
        />{t("Se souvenir de moi")}</label>

      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className={buttonClass("primary", "mt-4 w-full rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60")}
      >
        {loading ? t("Connexion…") : t("Me connecter")}
      </button>
    </div>
  );
}
