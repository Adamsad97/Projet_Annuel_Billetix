"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

type Status = "loading" | "success" | "error";

export function VerifyEmailStatus({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [message, setMessage] = useState<string>(
    t("Ce lien est invalide ou incomplet."),
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage(
          err instanceof ApiError
            ? err.message
            : t("Impossible de vérifier cet email pour le moment."),
        );
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className={cardClass("relative w-full max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15 text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-ink-1">{t("Vérification en cours…")}</h1>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={cardClass("relative w-full max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ✕
        </div>
        <h1 className="text-2xl font-bold text-ink-1">{t("Vérification impossible")}</h1>
        <p className="mt-2 text-sm text-accent/70">{message}</p>
        <p className="mt-4 text-xs text-ink-5">{t("Lien expiré ?")}{" "}
          <Link href="/contact" className="font-medium text-link hover:text-link-hover">{t("Contactez-nous")}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass("relative w-full max-w-md p-8 text-center")}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-ink-1">{t("Adresse email vérifiée")}</h1>
      <p className="mt-2 text-sm text-accent/70">{t("Votre compte BilleTix est maintenant actif. Vous pouvez vous connecter et profiter de tous les événements.")}</p>

      <Link
        href="/connexion"
        className={buttonClass("primary", "mt-6 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm")}
      >{t("Se connecter")}</Link>
    </div>
  );
}
