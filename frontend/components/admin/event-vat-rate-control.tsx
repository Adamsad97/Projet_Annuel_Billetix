"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/http-error";
import { setEventVatRate } from "@/lib/api/admin";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { listVatRates, vatRateOptionLabel, type ApiVatRate } from "@/lib/api/vat-rates";

/** Taux de TVA d'un événement à la validation, corrigeable tant qu'il n'est pas publié. */
export function EventVatRateControl({
  eventId,
  vatRate,
  vatRateLabel,
  editable,
  onChanged,
}: {
  eventId: string;
  vatRate: string | undefined;
  vatRateLabel: string | null | undefined;
  editable: boolean;
  onChanged: () => void;
}) {
  const [vatRates, setVatRates] = useState<ApiVatRate[]>([]);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editable) return;
    listVatRates()
      .then(setVatRates)
      .catch(() => setVatRates([]));
  }, [editable]);

  const current = vatRateOptionLabel({ rate: vatRate ?? "0.2", label: vatRateLabel ?? "Taux normal" });
  const currentId =
    vatRates.find((rate) => Number(rate.rate) === Number(vatRate ?? 0.2) && rate.label === (vatRateLabel ?? rate.label))?.id ?? "";
  const selected = choice || currentId;

  async function apply() {
    if (!selected || selected === currentId) return;
    setBusy(true);
    setError(null);
    try {
      await setEventVatRate(eventId, selected);
      setChoice("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le taux n'a pas pu être corrigé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <dt className="text-ink-5">Taux de TVA</dt>
      <dd className="text-ink-2">{current}</dd>
      {editable && vatRates.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Corriger le taux de TVA"
            value={selected}
            onChange={(event) => setChoice(event.target.value)}
            className={fieldClass("px-3 py-2")}
          >
            {!currentId ? <option value="">{current} (taux actuel)</option> : null}
            {vatRates.map((rate) => (
              <option key={rate.id} value={rate.id}>
                {vatRateOptionLabel(rate)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selected || selected === currentId}
            onClick={apply}
            className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
          >
            {busy ? "Correction…" : "Corriger le taux"}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
