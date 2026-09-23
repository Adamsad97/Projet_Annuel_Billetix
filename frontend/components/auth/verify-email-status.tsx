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
      <div className="relative w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-2xl">
          ⏳
        </div>
        <h1 className="text-xl font-bold text-white">Vérification en cours…</h1>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl">
          ✕
        </div>
        <h1 className="text-2xl font-bold text-white">Vérification impossible</h1>
        <p className="mt-2 text-sm text-violet-200/70">{message}</p>
        <p className="mt-4 text-xs text-gray-500">
          Lien expiré ?{" "}
          <Link href="/contact" className="font-medium text-violet-400 hover:text-violet-300">
            Contacte-nous
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-white">Adresse email vérifiée</h1>
      <p className="mt-2 text-sm text-violet-200/70">
        Ton compte BilletiX est maintenant actif. Tu peux te connecter et
        profiter de tous les événements.
      </p>

      <Link
        href="/connexion"
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
      >
        Se connecter
      </Link>
    </div>
  );
}
