"use client";

import Link from "next/link";
import { useState } from "react";
import { requestResale } from "@/lib/api/tickets";
import { ApiError } from "@/lib/api/http-error";
import type { TicketDetail } from "@/lib/mock/ticket-detail";

export function ResellForm({ ticket }: { ticket: TicketDetail }) {
  const [price, setPrice] = useState(ticket.unitPriceTtc.toFixed(2));
  const [listed, setListed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (listed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h2 className="text-lg font-bold text-white">Billet mis en revente</h2>
        <p className="mt-1 text-sm text-gray-400">
          Il apparaît maintenant sur la marketplace, réservé 10 minutes à
          chaque acheteur intéressé.
        </p>
        <Link
          href="/revente"
          className="mt-4 inline-flex rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          Voir la marketplace →
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const resalePrice = Number(price);
    if (!Number.isFinite(resalePrice) || resalePrice <= 0 || resalePrice > ticket.unitPriceTtc) {
      setError(
        `Le prix doit être compris entre 0,01 € et ${ticket.unitPriceTtc.toFixed(2)} € (valeur faciale).`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestResale(ticket.id, ticket.orderId, resalePrice);
      setListed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de mettre ce billet en revente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/5 bg-[#12101c] p-6"
    >
      <h2 className="text-base font-bold text-white">Mettre ce billet en revente</h2>
      <p className="mt-1 text-sm text-gray-500">
        {ticket.eventName} — {ticket.categoryName}
      </p>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-violet-200/80">Prix de revente</span>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={ticket.unitPriceTtc}
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="w-full bg-transparent text-lg font-bold text-white focus:outline-none"
          />
          <span className="text-sm text-gray-500">€</span>
        </div>
      </label>
      <p className="mt-2 text-xs text-gray-500">
        🛡️ Prix plafonné à la valeur faciale ({ticket.unitPriceTtc.toFixed(2)} €) — la
        revente à profit n&apos;est pas autorisée sur BilletiX.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Mise en revente…" : "Confirmer la mise en revente"}
      </button>
    </form>
  );
}
