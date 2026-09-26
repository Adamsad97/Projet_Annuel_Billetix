"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";

type Status = "loading" | "success" | "error";

export function VerifyEmailStatus({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [message, setMessage] = useState<string>(
    "Ce lien est invalide ou incomplet.",
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
            : "Impossible de vérifier cet email pour le moment.",
        );
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="relative w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15 text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-ink-1">Vérification en cours…</h1>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ✕
        </div>
        <h1 className="text-2xl font-bold text-ink-1">Vérification impossible</h1>
        <p className="mt-2 text-sm text-accent/70">{message}</p>
        <p className="mt-4 text-xs text-ink-5">
          Lien expiré ?{" "}
          <Link href="/contact" className="font-medium text-link hover:text-link-hover">
            Contactez-nous
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md rounded-2xl border border-hairline-1 bg-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-ink-1">Adresse email vérifiée</h1>
      <p className="mt-2 text-sm text-accent/70">
        Votre compte BilletiX est maintenant actif. Vous pouvez vous connecter et
        profiter de tous les événements.
      </p>

      <Link
        href="/connexion"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
      >
        Se connecter
      </Link>
    </div>
  );
}
