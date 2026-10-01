"use client";

// Report par l'organisateur : « request » demande à l'admin, « reschedule » fixe la nouvelle date.

import { useId, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { longDateTime } from "@/lib/format/dates";

export type PostponeDialogResult =
  | { mode: "request"; reason: string; dates: { start: string; end: string } | null }
  | { mode: "reschedule"; dates: { start: string; end: string } };

/** Valeur d'un champ datetime-local (heure de l'appareil) en ISO. */
function toIso(value: string): string | null {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

export function PostponeDialog({
  mode,
  open,
  eventTitle,
  currentStart,
  onClose,
  onSubmit,
}: {
  mode: "request" | "reschedule";
  open: boolean;
  eventTitle: string;
  /** Date actuelle (ou d'origine) : la nouvelle doit être postérieure. */
  currentStart: string;
  onClose: () => void;
  onSubmit: (result: PostponeDialogResult) => Promise<void>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [dateKnown, setDateKnown] = useState(mode === "reschedule");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const needsDates = mode === "reschedule" || dateKnown;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "request" && !reason.trim()) {
      setError("Expliquez la raison du report : elle est communiquée aux acheteurs.");
      return;
    }
    let dates: { start: string; end: string } | null = null;
    if (needsDates) {
      const startIso = toIso(start);
      const endIso = toIso(end);
      if (!startIso || !endIso) {
        setError("Indiquez la date et l'heure de début et de fin.");
        return;
      }
      if (new Date(startIso) <= new Date(currentStart)) {
        setError(`La nouvelle date doit être postérieure au ${longDateTime.format(new Date(currentStart))}.`);
        return;
      }
      if (new Date(endIso) <= new Date(startIso)) {
        setError("La fin doit être postérieure au début.");
        return;
      }
      dates = { start: startIso, end: endIso };
    }
    setSending(true);
    try {
      await onSubmit(
        mode === "request" ? { mode, reason: reason.trim(), dates } : { mode, dates: dates as { start: string; end: string } },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'envoi a échoué, veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!sending} labelledBy={`${id}-title`} className="bg-black/70 p-4 sm:p-6">
      <form onSubmit={submit} className="flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-hairline-2 bg-card p-6 shadow-2xl">
        <h2 id={`${id}-title`} className="text-lg font-bold text-ink-1">
          {mode === "request" ? "Demander le report de l'événement" : "Fixer la nouvelle date"}
        </h2>
        <p className="mt-1 text-sm font-medium text-ink-2">{eventTitle}</p>
        <p className="mt-2 text-sm text-ink-4">
          {mode === "request"
            ? "Votre demande est examinée par l'administration ; l'événement reste en vente en attendant. Une fois le report accepté, les acheteurs sont prévenus par email : leur billet reste valable pour la nouvelle date, et ils peuvent demander le remboursement."
            : "Les ventes et le contrôle des billets reprennent à cette date. Les acheteurs sont prévenus par email et peuvent demander le remboursement pendant le délai prévu."}
        </p>

        {error ? <FormError className="mt-4">{error}</FormError> : null}

        {mode === "request" ? (
          <>
            <label htmlFor={`${id}-reason`} className="mt-4 text-sm font-medium text-ink-2">
              Motif du report *
            </label>
            <textarea
              id={`${id}-reason`}
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. : salle indisponible, artiste malade…"
              className={fieldClass("mt-1.5 w-full resize-none px-3 py-2")}
            />

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-ink-2">Nouvelle date</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  { known: true, label: "Je la connais", hint: "Elle est communiquée aux acheteurs." },
                  { known: false, label: "Date à venir", hint: "Ventes et contrôle suspendus jusqu'à ce que vous la fixiez." },
                ].map((option) => (
                  <label
                    key={String(option.known)}
                    className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                      dateKnown === option.known ? "border-blue-500 bg-blue-600/10" : "border-hairline-2 hover:border-hairline-4"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-known`}
                      checked={dateKnown === option.known}
                      onChange={() => setDateKnown(option.known)}
                      className="sr-only"
                    />
                    <span className="block font-semibold text-ink-1">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-5">{option.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}

        {needsDates ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              Début *
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass("px-3 py-2.5")} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              Fin *
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={fieldClass("px-3 py-2.5")} />
            </label>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}>
            Annuler
          </button>
          <button type="submit" disabled={sending} className={buttonClass("primary", "rounded-full px-5 py-2 text-sm disabled:opacity-50")}>
            {sending ? "Envoi…" : mode === "request" ? "Envoyer la demande" : "Enregistrer la nouvelle date"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
