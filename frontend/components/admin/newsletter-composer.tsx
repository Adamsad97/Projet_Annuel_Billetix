"use client";

import { useEffect, useState } from "react";
import { getNewsletterRecipientsCount, sendNewsletter } from "@/lib/api/admin-newsletter";
import { ApiError } from "@/lib/api/http-error";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

export function NewsletterComposer() {
  const [recipientsCount, setRecipientsCount] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNewsletterRecipientsCount()
      .then((data) => {
        if (!cancelled) setRecipientsCount(data.count);
      })
      .catch(() => {
        if (!cancelled) setRecipientsCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Confirmation dans une fenêtre du site avec récapitulatif, plutôt que window.confirm().
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    const recipientsLabel =
      recipientsCount === null
        ? t("tous les abonnés")
        : (recipientsCount > 1 ? t("{recipientsCount} abonnés", { recipientsCount }) : t("{recipientsCount} abonné", { recipientsCount }));

    setDialog({
      title: t("Envoyer la newsletter ?"),
      message: t("Elle sera envoyée immédiatement à {recipientsLabel}. Un envoi ne peut pas être annulé.", { recipientsLabel }),
      confirmLabel: t("Envoyer maintenant"),
      details: (
        <dl className="flex flex-col gap-3 rounded-xl bg-hairline-1 p-4 text-sm ring-1 ring-inset ring-hairline-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-5">{t("Destinataires")}</dt>
            <dd className="font-semibold text-ink-1">{recipientsLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-5">{t("Sujet")}</dt>
            <dd className="font-semibold text-ink-1">{subject.trim()}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-5">{t("Aperçu")}</dt>
            <dd className="line-clamp-3 whitespace-pre-line text-ink-3">{body.trim()}</dd>
          </div>
        </dl>
      ),
      onConfirm: () => {
        void send();
      },
    });
  }

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const data = await sendNewsletter(subject.trim(), body.trim());
      setResult(data);
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Impossible d'envoyer la newsletter."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ActionDialog state={dialog} onClose={() => setDialog(null)} />

      <div className={cardClass("p-5")}>
        <p className="text-xs uppercase tracking-wide text-ink-5">{t("Destinataires")}</p>
        <p className="mt-1 text-2xl font-bold text-ink-1">
          {recipientsCount === null ? "…" : recipientsCount}
          <span className="ml-2 text-sm font-normal text-ink-5">{recipientsCount === 1 ? t("acheteur abonné à la newsletter") : t("acheteurs abonnés à la newsletter")}</span>
        </p>
      </div>

      {result ? (
        <Alert tone="success">{result.sent === 1 ? t("✓ Newsletter envoyée à {sent} destinataire.", { sent: result.sent }) : t("✓ Newsletter envoyée à {sent} destinataires.", { sent: result.sent })}</Alert>
      ) : null}

      {error ? (
        <Alert>
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={cardClass("flex flex-col gap-4 p-6")}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Sujet")}</span>
          <input
            type="text"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t("Les nouveautés BilleTix du mois")}
            className={fieldClass("px-4 py-3")}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-accent/80">{t("Contenu")}</span>
          <textarea
            required
            rows={10}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("Écrivez le contenu de votre newsletter ici…")}
            className={fieldClass("resize-none px-4 py-3")}
          />
        </label>

        <button
          type="submit"
          disabled={sending || !subject.trim() || !body.trim() || recipientsCount === 0}
          className={buttonClass("primary", "mt-1 w-full rounded-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
        >
          {sending ? t("Envoi en cours…") : t("Envoyer la newsletter →")}
        </button>
        {recipientsCount === 0 ? (
          <p className="text-center text-xs text-ink-5">{t("Aucun abonné pour le moment — l'envoi est désactivé.")}</p>
        ) : null}
      </form>
    </div>
  );
}
