"use client";

// File des vérifications d'identité, du plus ancien au plus récent ; l'examen se fait sur la fiche de l'organisateur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { listPendingKyc, type ApiPendingKyc } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { dateTime } from "@/lib/format/dates";
import { t } from "@/lib/i18n/translate";

export default function AdminKycPage() {
  const [pending, setPending] = useState<ApiPendingKyc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPendingKyc()
      .then(setPending)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger les vérifications.")));
  }, []);

  return (
    <AdminShell active="/admin/kyc">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Vérifications d'identité")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Pièces d'identité envoyées par les organisateurs. Tant qu'elle n'est pas validée, un organisateur ne reçoit aucun reversement.")}</p>
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : pending === null ? (
        <MutedMessage />
      ) : pending.length === 0 ? (
        <div className={cardClass("px-5 py-10 text-center")}>
          <p className="font-semibold text-ink-1">{t("Aucune vérification en attente")}</p>
          <p className="mt-1 text-sm text-ink-5">{t("Vous serez prévenu par email à chaque nouvelle pièce envoyée.")}</p>
        </div>
      ) : (
        <div className={cardClass("overflow-hidden")}>
          {pending.map((item) => (
            <div
              key={item.user_id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink-1">{item.display_name}</p>
                <p className="mt-0.5 text-xs text-ink-5">
                  {[item.owner_name, item.owner_email].filter(Boolean).join(" · ")}
                  {item.kyc_submitted_at ? t(" · envoyée le {value}", { value: dateTime.format(new Date(item.kyc_submitted_at)) }) : ""}
                </p>
              </div>
              <Link href={`/admin/utilisateurs/${item.user_id}#kyc`} className={buttonClass("primary", "rounded-full px-4 py-2 text-sm")}>{t("Examiner →")}</Link>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
