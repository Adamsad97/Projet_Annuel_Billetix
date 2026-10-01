"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DocumentDropzone } from "@/components/ui/document-dropzone";
import { getKycStatus, submitKyc, type ApiKycStatus, type KycStatus } from "@/lib/api/kyc";
import { uploadDocument } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/http-error";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t, msg } from "@/lib/i18n/translate";
import { dateFormat } from "@/lib/i18n/intl";

const STATUS_DISPLAY: Record<KycStatus, { label: string; className: string }> = {
  PENDING: { label: msg("À fournir"), className: "bg-hairline-2 text-ink-3" },
  SUBMITTED: { label: msg("En cours d'examen"), className: "bg-amber-500/15 text-amber-500" },
  VERIFIED: { label: msg("Vérifiée"), className: "bg-emerald-500/15 text-emerald-500" },
  REJECTED: { label: msg("Refusée"), className: "bg-red-500/15 text-red-400" },
};

function formatDay(value: string | null): string {
  return value ? dateFormat({ day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "";
}

/** Vérification d'identité : dépôt de la pièce (privée), puis examen par un admin. */
export function KycSection() {
  const [kyc, setKyc] = useState<ApiKycStatus | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getKycStatus()
      .then((result) => {
        if (!cancelled) setKyc(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setKyc(null);
        else setLoadError(err instanceof ApiError ? err.message : t("Impossible de charger votre vérification d'identité."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!file) return;
    setSending(true);
    setSendError(null);
    try {
      const { url } = await uploadDocument(file);
      await submitKyc(url);
      setKyc(await getKycStatus());
      setFile(null);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : t("L'envoi a échoué, veuillez réessayer."));
    } finally {
      setSending(false);
    }
  }

  const status = kyc ? STATUS_DISPLAY[kyc.kyc_status] : null;
  const canSubmit = kyc && (kyc.kyc_status === "PENDING" || kyc.kyc_status === "REJECTED");

  return (
    <section className={cardClass("p-6")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink-1">{t("Vérification d'identité")}</h2>
        {status ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{t(status.label)}</span>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-danger">{loadError}</p>
      ) : kyc === undefined ? (
        <p className="text-sm text-ink-5">{t("Chargement…")}</p>
      ) : kyc === null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-5">{t("Créez d'abord votre profil organisateur ; vous pourrez ensuite fournir votre pièce d'identité.")}</p>
          <Link
            href="/dashboard/profil"
            className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >{t("Créer mon profil organisateur →")}</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {kyc.kyc_status === "SUBMITTED" ? (
            <p className="text-sm text-ink-4">{t("Votre pièce a été transmise le {day}. Un administrateur l'examine ; vous serez informé de sa décision.", { day: formatDay(kyc.kyc_submitted_at) })}</p>
          ) : null}
          {kyc.kyc_status === "VERIFIED" ? (
            <p className="text-sm text-ink-4">{t("Votre identité a été vérifiée le {day}.", { day: formatDay(kyc.kyc_verified_at) })}</p>
          ) : null}
          {kyc.kyc_status === "REJECTED" ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{kyc.kyc_rejected_reason ? t("Votre pièce a été refusée : {reason} Veuillez en fournir une nouvelle.", { reason: kyc.kyc_rejected_reason }) : t("Votre pièce a été refusée. Veuillez en fournir une nouvelle.")}</div>
          ) : null}

          {canSubmit ? (
            <>
              <p className="text-sm text-ink-5">{t("Fournissez une pièce d'identité en cours de validité (carte d'identité, passeport) ou, pour une structure, un extrait Kbis ou les statuts de l'association. Le document reste privé : seuls vous et les administrateurs de la plateforme peuvent le consulter.")}</p>
              <DocumentDropzone
                onFileSelected={setFile}
                disabled={sending}
                hint={t("Glissez votre pièce justificative ou cliquez pour la choisir")}
              />
              {sendError ? (
                <p className="text-sm text-danger" role="alert">
                  {sendError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!file || sending}
                onClick={handleSubmit}
                className={buttonClass("primary", "self-end rounded-full px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40")}
              >
                {sending ? t("Envoi…") : t("Envoyer pour vérification")}
              </button>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
