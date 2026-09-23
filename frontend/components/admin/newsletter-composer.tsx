"use client";

import { useEffect, useState } from "react";
import { getNewsletterRecipientsCount, sendNewsletter } from "@/lib/api/admin-newsletter";
import { ApiError } from "@/lib/api/http-error";

export function NewsletterComposer() {
  const [recipientsCount, setRecipientsCount] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    const confirmed = window.confirm(
      recipientsCount !== null
        ? `Envoyer cette newsletter à ${recipientsCount} abonné(s) ? Cette action est irréversible.`
        : "Envoyer cette newsletter ? Cette action est irréversible.",
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const data = await sendNewsletter(subject.trim(), body.trim());
      setResult(data);
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer la newsletter.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
        <p className="text-xs uppercase tracking-wide text-gray-500">Destinataires</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {recipientsCount === null ? "…" : recipientsCount}
          <span className="ml-2 text-sm font-normal text-gray-500">
            acheteur{recipientsCount === 1 ? "" : "s"} abonné{recipientsCount === 1 ? "" : "s"} à la newsletter
          </span>
        </p>
      </div>

      {result ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-300">
          ✓ Newsletter envoyée à {result.sent} destinataire{result.sent === 1 ? "" : "s"}.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#12101c] p-6"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Sujet</span>
          <input
            type="text"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Les nouveautés BilletiX du mois"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Contenu</span>
          <textarea
            required
            rows={10}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Écris le contenu de ta newsletter ici…"
            className="resize-none rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={sending || !subject.trim() || !body.trim() || recipientsCount === 0}
          className="mt-1 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Envoi en cours…" : "Envoyer la newsletter →"}
        </button>
        {recipientsCount === 0 ? (
          <p className="text-center text-xs text-gray-500">
            Aucun abonné pour le moment — l&apos;envoi est désactivé.
          </p>
        ) : null}
      </form>
    </div>
  );
}
