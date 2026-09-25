"use client";

// Bug corrigé (fonctionnalité cassée de bout en bout) : le callback OAuth
// backend redirige ici depuis toujours (googleCallback/facebookCallback,
// api-gateway), mais cette page n'a jamais existé côté frontend — un
// utilisateur complétant une connexion Google/Facebook tombait sur un 404,
// le code d'échange (Redis, usage unique, 60s) perdu pour rien.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  exchangeOAuthCode,
  isOAuthPending2fa,
  verifyOAuth2fa,
} from "@/lib/api/auth";
import { saveSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/http-error";

// Bug corrigé : même correctif que login-form.tsx — "/" rebondit aussitôt
// vers "/admin" pour un ADMIN/SUPER_ADMIN (BuyerOnlyGate).
function postLoginPath(role: string): string {
  return role === "ADMIN" || role === "SUPER_ADMIN" ? "/admin" : "/";
}

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = useState<"loading" | "error" | "needs_2fa">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string>("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setError("Lien de connexion invalide — le code est manquant.");
      return;
    }

    exchangeOAuthCode(code)
      .then((result) => {
        if (isOAuthPending2fa(result)) {
          setPendingToken(result.pending_token);
          setTwoFactorMethod(result.two_factor_method);
          setStatus("needs_2fa");
          return;
        }
        saveSession(result);
        router.push(postLoginPath(result.user.role));
      })
      .catch((err) => {
        setStatus("error");
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de finaliser la connexion, réessaie.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingToken) return;
    setVerifying(true);
    setError(null);
    try {
      const session = await verifyOAuth2fa(pendingToken, twoFactorCode);
      saveSession(session);
      router.push(postLoginPath(session.user.role));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Code invalide, réessaie.",
      );
      setVerifying(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[#07060c] px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8">
        {status === "loading" ? (
          <p className="text-center text-sm text-gray-500">Connexion en cours…</p>
        ) : status === "error" ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-white">Connexion impossible</h1>
            </div>
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-300 ring-1 ring-inset ring-red-500/30">
              {error}
            </p>
            <Link
              href="/connexion"
              className="mt-6 block rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
            >
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold text-white">Code de vérification</h1>
              <p className="mt-1 text-sm text-violet-200/70">
                Entre le code affiché dans ton application d&apos;authentification
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
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-lg tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
