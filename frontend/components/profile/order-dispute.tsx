"use client";

// Réclamation sur une commande : « Signaler un problème » tant qu'aucune
// n'est en cours, puis suivi (reçue, en cours d'examen, réponse de l'équipe).

import { useEffect, useId, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cardClass } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { listMyDisputes, openDispute, type ApiBuyerDispute } from "@/lib/api/orders";
import { buyerDisputeReasons } from "@/lib/constants/admin-disputes";
import { ApiError } from "@/lib/api/http-error";
import { dateTime } from "@/lib/format/dates";
import { t, msg } from "@/lib/i18n/translate";

const STATUS: Record<ApiBuyerDispute["status"], { label: string; className: string; text: string }> = {
  OPEN: {
    label: msg("Reçue"),
    className: "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30",
    text: msg("Votre réclamation a bien été reçue. L'équipe BilleTix l'examine et vous répondra par email."),
  },
  UNDER_REVIEW: {
    label: msg("En cours d'examen"),
    className: "bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/30",
    text: msg("Un membre de l'équipe examine votre réclamation. Vous serez prévenu par email de sa décision."),
  },
  LOST: {
    label: msg("Acceptée"),
    className: "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/30",
    text: msg("Votre réclamation a été acceptée."),
  },
  WON: {
    label: msg("Non retenue"),
    className: "bg-red-500/15 text-red-600 ring-1 ring-inset ring-red-500/30",
    text: msg("Après examen, votre réclamation n'a pas été retenue."),
  },
  CLOSED: {
    label: msg("Close"),
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
    text: msg("Votre réclamation a été close."),
  },
};

export function OrderDispute({ orderId, canReport }: { orderId: string; canReport: boolean }) {
  const id = useId();
  const [dispute, setDispute] = useState<ApiBuyerDispute | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(buyerDisputeReasons[0].id);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listMyDisputes()
      .then((list) => setDispute(list.find((item) => item.order_id === orderId) ?? null))
      .catch(() => setDispute(null));
  }, [orderId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (description.trim().length < 10) {
      setError(t("Décrivez le problème en quelques mots (10 caractères minimum)."));
      return;
    }
    setSending(true);
    setError(null);
    try {
      setDispute(await openDispute(orderId, reason, description.trim()));
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("L'envoi a échoué, veuillez réessayer."));
    } finally {
      setSending(false);
    }
  }

  if (dispute === undefined) return null;

  if (dispute) {
    const status = STATUS[dispute.status];
    return (
      <section aria-label={t("Réclamation")} className={cardClass("mt-6 p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink-1">{t("Réclamation du {value}", { value: dateTime.format(new Date(dispute.created_at)) })}</p>
          <Badge tone={status.className}>{t(status.label)}</Badge>
        </div>
        <p className="mt-2 text-sm text-ink-3">{t(status.text)}</p>
        {dispute.resolution_notes ? (
          <p className="mt-3 rounded-xl bg-hairline-1 px-4 py-3 text-sm text-ink-2">
            <span className="font-semibold">{t("Réponse de l'équipe :")}{" "}</span>
            {dispute.resolution_notes}
          </p>
        ) : null}
      </section>
    );
  }

  if (!canReport) return null;

  return (
    <>
      <p className="mt-6 text-center text-sm text-ink-5">{t("Un problème avec cette commande ?")}{" "}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-link hover:text-link-hover">{t("Signaler un problème")}</button>
      </p>
      <Modal open={open} onClose={() => setOpen(false)} dismissible={!sending} labelledBy={`${id}-title`} className="bg-black/70 p-4 sm:p-6">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-hairline-2 bg-card p-6 shadow-2xl">
          <h2 id={`${id}-title`} className="text-lg font-bold text-ink-1">{t("Signaler un problème")}</h2>
          <p className="mt-1 text-sm text-ink-4">{t("L'équipe BilleTix examine chaque réclamation et vous répond par email.")}</p>
          {error ? <FormError className="mt-4">{error}</FormError> : null}
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink-2">{t("Motif")}<select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass("px-3 py-2.5")}>
              {buyerDisputeReasons.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink-2">{t("Décrivez le problème *")}<textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass("resize-none px-3 py-2")}
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={sending} className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}>{t("Annuler")}</button>
            <button type="submit" disabled={sending} className={buttonClass("primary", "rounded-full px-5 py-2 text-sm disabled:opacity-50")}>
              {sending ? t("Envoi…") : t("Envoyer")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
