"use client";

// Bug corrigé : ce composant ne faisait que basculer entre 3 écrans
// factices en mémoire, sans jamais appeler le backend — la 2FA affichée
// "Activée" n'avait aucun rapport avec l'état réel du compte.

import { useEffect, useState, type FormEvent } from "react";
import {
  confirm2fa,
  disable2fa,
  get2faStatus,
  setup2fa,
  type TwoFactorSetup,
} from "@/lib/api/two-factor";
import { ApiError } from "@/lib/api/http-error";

type Step =
  | "loading"
  | "off"
  | "setup"
  | "backup-codes"
  | "on"
  | "disabling"
  | "load-error";

export function TwoFactorManager() {
  const [step, setStep] = useState<Step>("loading");
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get2faStatus()
      .then((enabled) => {
        if (!cancelled) setStep(enabled ? "on" : "off");
      })
      .catch(() => {
        if (!cancelled) setStep("load-error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStartSetup() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await setup2fa();
      setSetupData(data);
      setStep("setup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'initialiser la 2FA.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSetup(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await confirm2fa(code);
      setBackupCodes(result.backup_codes);
      setCode("");
      setStep("backup-codes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Code invalide, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await disable2fa(code);
      setCode("");
      setStep("off");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de désactiver la 2FA.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") {
    return <p className="text-center text-sm text-gray-500">Chargement…</p>;
  }

  if (step === "load-error") {
    return (
      <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
        Impossible de charger l&apos;état de la 2FA.
      </p>
    );
  }

  if (step === "on") {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Authentification 2FA</h1>
            <p className="mt-1 text-sm text-gray-500">Via application TOTP (Google Authenticator)</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
            Activé
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("disabling");
          }}
          className="mt-6 w-full rounded-full bg-red-500/15 py-3 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25"
        >
          Désactiver la 2FA
        </button>
      </div>
    );
  }

  if (step === "disabling") {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-6">
        <h1 className="text-lg font-bold text-white">Désactiver la 2FA</h1>
        <p className="mt-1 text-sm text-gray-500">
          Saisis un code de ton application TOTP (ou un code de secours) pour confirmer.
        </p>

        <form onSubmit={handleDisable} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code à 6 chiffres ou code de secours"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-lg tracking-[0.2em] text-white placeholder:text-sm placeholder:tracking-normal placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          {error ? <p className="text-center text-xs text-red-300">{error}</p> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setCode("");
                setError(null);
                setStep("on");
              }}
              className="flex-1 rounded-full bg-white/5 py-3 text-sm font-medium text-gray-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-full bg-red-500/15 py-3 text-sm font-semibold text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Désactivation…" : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "backup-codes") {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-6">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h1 className="text-center text-lg font-bold text-white">2FA activée</h1>
        <p className="mt-1 text-center text-sm text-amber-300">
          ⚠️ Note ces codes de secours maintenant — ils ne seront plus jamais réaffichés.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 font-mono text-sm text-white">
          {backupCodes.map((backupCode) => (
            <span key={backupCode}>{backupCode}</span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStep("on")}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
        >
          J&apos;ai noté mes codes
        </button>
      </div>
    );
  }

  if (step === "setup" && setupData) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-6">
        <h1 className="text-lg font-bold text-white">Activer la 2FA</h1>
        <p className="mt-1 text-sm text-gray-500">
          Scanne ce code avec Google Authenticator ou une app TOTP équivalente.
        </p>

        <div className="mx-auto my-5 w-36">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI généré côté serveur */}
          <img src={setupData.qrCodeDataUrl} alt="QR code 2FA" className="w-full rounded-lg" />
        </div>

        <p className="mb-4 text-center font-mono text-xs text-gray-500">
          Clé manuelle : {setupData.secret}
        </p>

        <form onSubmit={handleConfirmSetup} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code à 6 chiffres"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-lg tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
          {error ? <p className="text-center text-xs text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Vérification…" : "Confirmer et activer"}
          </button>
        </form>
      </div>
    );
  }

  // step === "off"
  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c] p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-2xl">
        ⚠️
      </div>
      <h1 className="text-lg font-bold text-white">2FA désactivée</h1>
      <p className="mt-1 text-sm text-gray-500">
        Ton compte est moins protégé sans authentification à deux facteurs.
      </p>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <button
        type="button"
        onClick={handleStartSetup}
        disabled={submitting}
        className="mt-4 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Chargement…" : "Activer la 2FA"}
      </button>
    </div>
  );
}
