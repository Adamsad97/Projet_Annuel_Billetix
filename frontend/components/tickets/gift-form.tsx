"use client";

// Offrir un billet à un autre compte BilleTix : transfert immédiat et
// définitif (pas d'acceptation du bénéficiaire). Deux étapes : saisie, puis
// récapitulatif à confirmer. L'API exige une connexion récente : sinon,
// brouillon mis de côté le temps de se reconnecter, puis restauré.

import Link from "next/link";
import { useEffect, useState } from "react";
import { giftTicket } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api/http-error";
import type { TicketDetail } from "@/lib/mock/ticket-detail";

interface Draft {
  recipientEmail: string;
  holderFirstName: string;
  holderLastName: string;
}

const draftKey = (ticketId: string) => `billetix_gift_draft_${ticketId}`;
const inputClass =
  "w-full rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

export function GiftForm({ ticket }: { ticket: TicketDetail }) {
  const [draft, setDraft] = useState<Draft>({ recipientEmail: "", holderFirstName: "", holderLastName: "" });
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retour de reconnexion : on reprend directement au récapitulatif.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(draftKey(ticket.id));
      if (!saved) return;
      window.sessionStorage.removeItem(draftKey(ticket.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restauration unique d'un brouillon stocké hors React
      setDraft(JSON.parse(saved) as Draft);
      setStep("confirm");
    } catch {
      // Stockage indisponible ou brouillon illisible : formulaire vide.
    }
  }, [ticket.id]);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUnderstood(false);
    setStep("confirm");
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await giftTicket(ticket.id, {
        recipient_email: draft.recipientEmail.trim(),
        holder_first_name: draft.holderFirstName.trim(),
        holder_last_name: draft.holderLastName.trim(),
      });
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        try {
          window.sessionStorage.setItem(draftKey(ticket.id), JSON.stringify(draft));
        } catch {
          // Tant pis : il faudra ressaisir après la reconnexion.
        }
        window.location.assign(`/connexion?reauth=1&next=${encodeURIComponent(`/billets/${ticket.id}/offrir`)}`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Le transfert a échoué, réessaie.");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">✓</div>
        <h2 className="text-lg font-bold text-ink-1">Billet offert</h2>
        <p className="mt-1 text-sm text-ink-4">
          Il est maintenant dans l&apos;espace de {draft.recipientEmail}, au nom de {draft.holderFirstName}{" "}
          {draft.holderLastName}. Vous avez reçu tous les deux un email de confirmation.
        </p>
        <Link
          href="/profil/billets"
          className="mt-4 inline-flex rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >
          Retour à mes billets
        </Link>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-2xl border border-hairline-1 bg-card p-6">
        <h2 className="text-base font-bold text-ink-1">Confirmer le transfert</h2>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-ink-5">Billet</dt>
            <dd className="font-medium text-ink-1">
              {ticket.eventName} — {ticket.categoryName} · {ticket.reference}
            </dd>
          </div>
          <div>
            <dt className="text-ink-5">Compte bénéficiaire</dt>
            <dd className="font-medium text-ink-1">{draft.recipientEmail}</dd>
          </div>
          <div>
            <dt className="text-ink-5">Au nom de (personne qui assistera à l&apos;événement)</dt>
            <dd className="font-medium text-ink-1">
              {draft.holderFirstName} {draft.holderLastName}
            </dd>
          </div>
        </dl>

        <label className="mt-5 flex items-start gap-2.5 text-sm text-ink-3">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
          />
          <span>
            Je comprends que le transfert est <strong>immédiat et définitif</strong> : le billet quittera mon
            compte et son QR code actuel ne sera plus valable.
          </span>
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={!understood || submitting}
            className="w-full rounded-full bg-blue-700 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Transfert…" : "Offrir le billet"}
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={submitting}
            className="w-full rounded-full py-2.5 text-sm font-medium text-ink-4 transition-colors hover:text-ink-2"
          >
            Modifier
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="rounded-2xl border border-hairline-1 bg-card p-6">
      <h2 className="text-base font-bold text-ink-1">Offrir ce billet</h2>
      <p className="mt-1 text-sm text-ink-5">
        {ticket.eventName} — {ticket.categoryName}
      </p>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-2">Email du compte BilleTix bénéficiaire</span>
        <input
          type="email"
          required
          autoComplete="off"
          value={draft.recipientEmail}
          onChange={(event) => update("recipientEmail", event.target.value)}
          placeholder="prenom.nom@exemple.com"
          className={inputClass}
        />
      </label>
      <p className="mt-1.5 text-xs text-ink-5">
        La personne doit déjà avoir un compte BilleTix avec un email vérifié.
      </p>

      <p className="mt-5 text-sm font-medium text-ink-2">Personne qui assistera à l&apos;événement</p>
      <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          maxLength={100}
          autoComplete="off"
          value={draft.holderFirstName}
          onChange={(event) => update("holderFirstName", event.target.value)}
          placeholder="Prénom"
          aria-label="Prénom du titulaire"
          className={inputClass}
        />
        <input
          type="text"
          required
          maxLength={100}
          autoComplete="off"
          value={draft.holderLastName}
          onChange={(event) => update("holderLastName", event.target.value)}
          placeholder="Nom"
          aria-label="Nom du titulaire"
          className={inputClass}
        />
      </div>

      <p className="mt-4 text-xs text-ink-5">
        🛡️ Le don est gratuit. Pour vendre un billet, utilise la revente (prix plafonné à la valeur faciale).
        Le transfert est tracé (date, compte, adresse IP) et visible par toi, le bénéficiaire et l&apos;équipe BilleTix.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-blue-700 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Continuer
      </button>
    </form>
  );
}
