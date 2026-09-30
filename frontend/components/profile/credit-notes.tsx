"use client";

// Avoirs de la commande : un par remboursement (annulation, report, service
// client, revente d'un billet). Chacun annule, pour son montant, la facture.

import { useEffect, useState } from "react";
import { cardClass } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { downloadCreditNote, listCreditNotes, type ApiCreditNote } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { euros } from "@/lib/format/money";
import { longDate } from "@/lib/format/dates";

// Un avoir vient d'être émis : son PDF est généré en quelques secondes.
const PENDING_REFRESH_MS = 4000;

export function CreditNotes({ orderId, refreshKey = 0 }: { orderId: string; refreshKey?: number }) {
  const [notes, setNotes] = useState<ApiCreditNote[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = () =>
      listCreditNotes(orderId)
        .then((list) => {
          if (cancelled) return;
          setNotes(list);
          if (list.some((note) => !note.pdf_ready)) timer = window.setTimeout(load, PENDING_REFRESH_MS);
        })
        .catch(() => undefined);
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderId, refreshKey]);

  if (notes.length === 0) return null;

  async function download(note: ApiCreditNote) {
    setDownloading(note.id);
    setError(null);
    try {
      await downloadCreditNote(orderId, note.id, note.number);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Téléchargement impossible, veuillez réessayer.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section aria-label="Avoirs" className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">Avoirs</h2>
      <div className={cardClass("overflow-hidden")}>
        {notes.map((note) => (
          <div key={note.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-1 px-5 py-4 last:border-b-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-1">
                Avoir {note.number} · {euros.format(note.amount_ttc)}
              </p>
              <p className="text-xs text-ink-5">
                {longDate.format(new Date(note.created_at))} · {note.reason}
              </p>
            </div>
            <button
              type="button"
              disabled={!note.pdf_ready || downloading === note.id}
              onClick={() => download(note)}
              className={buttonClass("secondary", "rounded-full px-4 py-2 text-xs disabled:opacity-50")}
            >
              {!note.pdf_ready ? "En préparation…" : downloading === note.id ? "Téléchargement…" : "📄 Télécharger (PDF)"}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-center text-sm text-danger">{error}</p> : null}
    </section>
  );
}
