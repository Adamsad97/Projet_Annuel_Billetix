"use client";

import { useEffect, useState } from "react";
import {
  getConnectStatus,
  openConnectDashboard,
  startConnectOnboarding,
  type ApiConnectStatus,
} from "@/lib/api/stripe-connect";
import { ApiError } from "@/lib/api/http-error";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";

type Badge = { label: string; className: string };

function badgeFor(status: ApiConnectStatus): Badge {
  if (status.onboarded) return { label: "Actif", className: "bg-emerald-500/15 text-emerald-500" };
  if (status.details_submitted) return { label: "En vérification", className: "bg-amber-500/15 text-amber-500" };
  if (status.connected) return { label: "À compléter", className: "bg-amber-500/15 text-amber-500" };
  return { label: "Non configuré", className: "bg-hairline-2 text-ink-3" };
}

/**
 * Option Stripe Connect : l'organisateur peut recevoir ses reversements via
 * Stripe (virements automatiques) plutôt que par virement de la plateforme
 * sur son IBAN. Identité et compte bancaire saisis chez Stripe.
 */
export function StripeConnectSection() {
  const [status, setStatus] = useState<ApiConnectStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);

  async function goTo(request: () => Promise<{ url: string }>) {
    setRedirecting(true);
    setActionError(null);
    try {
      const { url } = await request();
      window.location.assign(url);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Stripe est momentanément indisponible, veuillez réessayer.");
      setRedirecting(false);
    }
  }

  useEffect(() => {
    // Retour depuis Stripe : ?stripe=retour (formulaire quitté) ou
    // ?stripe=relancer (lien expiré — on en génère un nouveau aussitôt).
    const origin = new URLSearchParams(window.location.search).get("stripe");
    if (origin) window.history.replaceState(null, "", window.location.pathname);
    if (origin === "relancer") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- redirection immédiate vers Stripe
      void goTo(startConnectOnboarding);
      return;
    }
    setReturned(origin === "retour");

    let cancelled = false;
    getConnectStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "Créez d'abord votre profil organisateur pour configurer vos reversements."
            : err instanceof ApiError
              ? err.message
              : "Impossible de charger votre compte de reversement.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = status ? badgeFor(status) : null;

  return (
    <section className={cardClass("p-6")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink-1">
          Stripe Connect <span className="text-sm font-normal text-ink-5">(facultatif)</span>
        </h2>
        {badge ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span> : null}
      </div>

      {loadError ? (
        <p className="text-sm text-ink-5">{loadError}</p>
      ) : status === null ? (
        <p className="text-sm text-ink-5">{redirecting ? "Redirection vers Stripe…" : "Chargement…"}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {status.onboarded ? (
            <>
              <p className="text-sm text-ink-4">
                Votre compte Stripe est prêt. Choisissez « Stripe Connect » comme moyen de reversement pour être
                payé automatiquement par Stripe.
              </p>
              {status.bank ? (
                <div className="flex items-center gap-3 rounded-xl bg-hairline-1 px-4 py-3 ring-1 ring-inset ring-hairline-2">
                  <span aria-hidden="true" className="text-xl">🏦</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-1">{status.bank.bank_name ?? "Compte bancaire"}</p>
                    <p className="font-mono text-xs text-ink-5">•••• •••• •••• {status.bank.last4}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : status.details_submitted ? (
            <p className="text-sm text-ink-4">
              Stripe vérifie les informations transmises (quelques minutes à quelques jours).
              {status.requirements_due > 0
                ? ` ${status.requirements_due} information${status.requirements_due > 1 ? "s" : ""} reste${status.requirements_due > 1 ? "nt" : ""} à fournir.`
                : ""}
            </p>
          ) : status.connected ? (
            <p className="text-sm text-ink-4">
              {returned
                ? "Votre inscription chez Stripe n'est pas terminée : reprenez-la là où vous l'avez laissée."
                : "Votre inscription chez Stripe a commencé mais n'est pas terminée."}
            </p>
          ) : (
            <p className="text-sm text-ink-4">
              Si vous le souhaitez, vous pouvez être payé par Stripe, notre prestataire de paiement, plutôt que par
              virement sur votre IBAN. Votre identité et votre compte bancaire sont alors saisis chez Stripe.
            </p>
          )}

          {actionError ? (
            <p role="alert" className="text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {status.onboarded || status.details_submitted ? (
              <button
                type="button"
                disabled={redirecting}
                onClick={() => goTo(openConnectDashboard)}
                className={buttonClass("secondary", "rounded-full px-5 py-2.5 text-sm disabled:opacity-50")}
              >
                {redirecting ? "Redirection…" : "Gérer sur Stripe ↗"}
              </button>
            ) : null}
            {!status.onboarded && (!status.details_submitted || status.requirements_due > 0) ? (
              <button
                type="button"
                disabled={redirecting}
                onClick={() => goTo(startConnectOnboarding)}
                className={buttonClass("primary", "rounded-full px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50")}
              >
                {redirecting
                  ? "Redirection vers Stripe…"
                  : status.connected
                    ? "Reprendre l'inscription"
                    : "Connecter un compte Stripe"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
