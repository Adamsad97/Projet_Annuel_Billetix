"use client";

// Décision sur un litige : réclamation acceptée (avec remboursement total,
// partiel ou sans remboursement), rejetée, ou close sans suite. La réponse
// est envoyée à l'acheteur et à l'organisateur.

import { useId, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { euros } from "@/lib/format/money";
import type { ResolveDisputeInput } from "@/lib/api/admin";

type Choice = "accept" | "reject" | "close";
type Refund = "full" | "partial" | "none";

export function DisputeDecisionDialog({
  open,
  refundable,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Montant encore remboursable sur la commande. */
  refundable: number;
  onClose: () => void;
  onSubmit: (input: ResolveDisputeInput) => Promise<void>;
}) {
  const id = useId();
  const [choice, setChoice] = useState<Choice>("accept");
  const [refund, setRefund] = useState<Refund>(refundable > 0 ? "full" : "none");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!notes.trim()) {
      setError("Expliquez votre décision : elle est envoyée à l'acheteur et à l'organisateur.");
      return;
    }
    const input: ResolveDisputeInput = {
      status: choice === "accept" ? "LOST" : choice === "reject" ? "WON" : "CLOSED",
      resolution_notes: notes.trim(),
    };
    if (choice === "accept" && refund === "full") input.refund_full = true;
    if (choice === "accept" && refund === "partial") {
      const value = Number(amount.replace(",", "."));
      if (!value || value <= 0 || value > refundable + 0.001) {
        setError(`Indiquez un montant entre 0,01 € et ${euros.format(refundable)}.`);
        return;
      }
      input.refund_amount_cents = Math.round(value * 100);
    }
    setSending(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La décision n'a pas pu être enregistrée.");
    } finally {
      setSending(false);
    }
  }

  const option = (value: Choice, label: string, hint: string) => (
    <label
      className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm transition-colors ${
        choice === value ? "border-blue-500 bg-blue-600/10" : "border-hairline-2 hover:border-hairline-4"
      }`}
    >
      <input type="radio" name={`${id}-choice`} checked={choice === value} onChange={() => setChoice(value)} className="sr-only" />
      <span className="block font-semibold text-ink-1">{label}</span>
      <span className="mt-0.5 block text-xs text-ink-5">{hint}</span>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} dismissible={!sending} labelledBy={`${id}-title`} className="bg-black/70 p-4 sm:p-6">
      <form onSubmit={submit} className="flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-hairline-2 bg-card p-6 shadow-2xl">
        <h2 id={`${id}-title`} className="text-lg font-bold text-ink-1">
          Trancher le litige
        </h2>
        <p className="mt-1 text-sm text-ink-4">Le reversement de la commande est débloqué dès la décision.</p>

        {error ? <FormError className="mt-4">{error}</FormError> : null}

        <div className="mt-4 grid gap-2">
          {option("accept", "Donner raison à l'acheteur", "Réclamation acceptée, avec ou sans remboursement.")}
          {option("reject", "Rejeter la réclamation", "La commande reste valable en l'état.")}
          {option("close", "Clore sans suite", "Réclamation retirée ou devenue sans objet.")}
        </div>

        {choice === "accept" ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-ink-2">Remboursement</legend>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {(
                [
                  ["full", `Total (${euros.format(refundable)})`],
                  ["partial", "Partiel"],
                  ["none", "Aucun"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 ${
                    refund === value ? "border-blue-500 bg-blue-600/10 text-ink-1" : "border-hairline-2 text-ink-3"
                  } ${value !== "none" && refundable <= 0 ? "pointer-events-none opacity-40" : ""}`}
                >
                  <input type="radio" name={`${id}-refund`} checked={refund === value} onChange={() => setRefund(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            {refund === "partial" ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink-2">
                Montant (€)
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className={fieldClass("w-32 px-3 py-2")}
                />
              </label>
            ) : null}
            {refund !== "none" ? (
              <p className="mt-2 text-xs text-ink-5">
                Remboursé sur le moyen de paiement d&apos;origine, avec un avoir. Remboursement total : billets annulés.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <label htmlFor={`${id}-notes`} className="mt-4 text-sm font-medium text-ink-2">
          Réponse à l&apos;acheteur *
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex. : billets introuvables dans votre compte, nous vous remboursons."
          className={fieldClass("mt-1.5 w-full resize-none px-3 py-2")}
        />

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}>
            Annuler
          </button>
          <button type="submit" disabled={sending} className={buttonClass("primary", "rounded-full px-5 py-2 text-sm disabled:opacity-50")}>
            {sending ? "Enregistrement…" : "Enregistrer la décision"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
