"use client";

import { useState } from "react";
import { DocumentDropzone } from "@/components/ui/document-dropzone";
import { updateEvent, type ApiEvent } from "@/lib/api/events";
import { uploadDocument } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/http-error";
import { t } from "@/lib/i18n/translate";

/** Justificatif refusé : motif, puis nouvel envoi qui repasse en examen. */
export function NonProfitResubmit({ event, onSubmitted }: { event: ApiEvent; onSubmitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const { url } = await uploadDocument(file);
      await updateEvent(event.id, { non_profit_document_url: url });
      setFile(null);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("L'envoi a échoué, veuillez réessayer."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-base font-semibold text-ink-1">{t("Justificatif « à but non lucratif » refusé")}</h2>
      {event.non_profit_rejection_reason ? (
        <p className="mt-2 text-sm text-ink-3">
          <span className="font-medium text-ink-2">{t("Motif :")}{" "}</span>
          {event.non_profit_rejection_reason}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-ink-4">{t("La commission standard s'applique. Envoyez un nouveau justificatif : il sera examiné à nouveau par notre équipe.")}</p>
      <div className="mt-4">
        <DocumentDropzone
          onFileSelected={setFile}
          disabled={sending}
          hint={t("Glissez le nouveau justificatif (statuts, récépissé de déclaration…) ou cliquez")}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!file || sending}
          onClick={handleSubmit}
          className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? t("Envoi…") : t("Envoyer le nouveau justificatif")}
        </button>
      </div>
    </section>
  );
}
