"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { Badge } from "@/components/ui/badge";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { ApiError } from "@/lib/api/http-error";
import {
  createVatRate,
  deleteVatRate,
  formatVatPercent,
  listAllVatRates,
  updateVatRate,
  type ApiVatRate,
} from "@/lib/api/vat-rates";

/** « 5,5 » saisi en pourcentage → 0.055 ; null si invalide. */
function percentToRate(value: string): number | null {
  const percent = Number(value.replace(",", ".").trim());
  if (value.trim() === "" || !Number.isFinite(percent) || percent < 0 || percent >= 100) return null;
  return Math.round(percent * 100) / 10000;
}

const smallButton =
  "rounded-lg border border-hairline-2 px-2.5 py-1 text-xs font-medium text-ink-3 transition-colors hover:border-hairline-4 disabled:opacity-50";

/**
 * Taux de TVA proposés à l'organisateur dans une liste déroulante quand il
 * crée un événement. Chaque événement garde sa copie du taux choisi :
 * modifier ou supprimer un taux ne change jamais le prix d'un événement
 * existant.
 */
export function VatRatesSection() {
  const [vatRates, setVatRates] = useState<ApiVatRate[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newPercent, setNewPercent] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPercent, setEditPercent] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function reload() {
    return listAllVatRates()
      .then(setVatRates)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les taux de TVA."));
  }

  useEffect(() => {
    void reload();
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'opération n'a pas pu être enregistrée.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = percentToRate(newPercent);
    if (rate === null) {
      setError("Saisissez un taux en pourcentage, entre 0 et 99,99 (ex. 5,5).");
      return;
    }
    setCreating(true);
    const ok = await run(() => createVatRate({ label: newLabel.trim(), rate }));
    setCreating(false);
    if (ok) {
      setNewLabel("");
      setNewPercent("");
    }
  }

  async function handleSave(vatRate: ApiVatRate) {
    const rate = percentToRate(editPercent);
    if (rate === null) {
      setError("Saisissez un taux en pourcentage, entre 0 et 99,99 (ex. 5,5).");
      return;
    }
    if (await run(() => updateVatRate(vatRate.id, { label: editLabel.trim(), rate }))) setEditingId(null);
  }

  function askDelete(vatRate: ApiVatRate) {
    setDialog({
      title: `Supprimer le taux ${formatVatPercent(vatRate.rate)} ?`,
      message:
        "Il ne sera plus proposé aux organisateurs. Les événements qui l'utilisent déjà gardent leur taux et leurs prix.",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: () => void run(() => deleteVatRate(vatRate.id)),
    });
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-ink-1">Taux de TVA</h2>
      <p className="mb-3 text-sm text-ink-5">
        Taux proposés à l&apos;organisateur dans une liste déroulante quand il crée un événement (ex. 5,5 % pour un
        spectacle vivant, 20 % pour un salon). Vous pouvez corriger le taux d&apos;un événement à sa validation. Un
        événement garde le taux choisi : modifier ou supprimer un taux ici ne change aucun prix existant.
      </p>

      <form onSubmit={handleCreate} className={cardClass("mb-4 flex flex-wrap items-end gap-3 p-4")}>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-accent/80">Taux (%) *</span>
          <input
            required
            inputMode="decimal"
            value={newPercent}
            onChange={(event) => setNewPercent(event.target.value)}
            placeholder="5,5"
            className={fieldClass("w-24 px-3 py-2 text-right")}
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-accent/80">Libellé *</span>
          <input
            required
            minLength={2}
            maxLength={80}
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Spectacles vivants, concerts"
            className={fieldClass("w-full px-3 py-2")}
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className={buttonClass("primary", "rounded-full px-5 py-2.5 text-sm disabled:opacity-50")}
        >
          {creating ? "Ajout…" : "+ Ajouter"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {vatRates === undefined ? (
        <MutedMessage />
      ) : (
        <div className={cardClass("overflow-hidden")}>
          {vatRates.map((vatRate) => (
            <div
              key={vatRate.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-1 px-4 py-3 last:border-b-0"
            >
              {editingId === vatRate.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    aria-label="Taux (%)"
                    inputMode="decimal"
                    value={editPercent}
                    onChange={(event) => setEditPercent(event.target.value)}
                    className={fieldClass("w-20 px-2 py-1.5 text-right")}
                  />
                  <span className="text-sm text-ink-5">%</span>
                  <input
                    aria-label="Libellé"
                    value={editLabel}
                    maxLength={80}
                    onChange={(event) => setEditLabel(event.target.value)}
                    className={fieldClass("min-w-40 flex-1 px-3 py-1.5")}
                  />
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`w-16 shrink-0 text-right text-base font-bold tabular-nums ${vatRate.is_active ? "text-ink-1" : "text-ink-5 line-through"}`}
                  >
                    {formatVatPercent(vatRate.rate)}
                  </span>
                  <span className={`truncate text-sm ${vatRate.is_active ? "text-ink-2" : "text-ink-5"}`}>{vatRate.label}</span>
                  {vatRate.is_default ? (
                    <Badge tone="bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30">Par défaut</Badge>
                  ) : null}
                  {!vatRate.is_active ? <Badge tone="bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2">Désactivé</Badge> : null}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {editingId === vatRate.id ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => handleSave(vatRate)} className={buttonClass("primary", "rounded-lg px-3 py-1.5 text-xs")}>
                      Enregistrer
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={smallButton}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    {!vatRate.is_default && vatRate.is_active ? (
                      <button type="button" disabled={busy} onClick={() => void run(() => updateVatRate(vatRate.id, { is_default: true }))} className={smallButton}>
                        Par défaut
                      </button>
                    ) : null}
                    {!vatRate.is_default ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => updateVatRate(vatRate.id, { is_active: !vatRate.is_active }))}
                        className={smallButton}
                      >
                        {vatRate.is_active ? "Désactiver" : "Activer"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(vatRate.id);
                        setEditLabel(vatRate.label);
                        setEditPercent(String(Math.round(Number(vatRate.rate) * 10000) / 100).replace(".", ","));
                      }}
                      className={smallButton}
                    >
                      Modifier
                    </button>
                    {!vatRate.is_default ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => askDelete(vatRate)}
                        className="rounded-lg border border-hairline-2 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:border-red-500/30 hover:bg-red-500/5 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
