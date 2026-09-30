"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  cancelBankTransfer,
  confirmBankTransfers,
  exportSepa,
  listBankTransfers,
  type ApiBankTransfer,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { euros } from "@/lib/format/money";
import { longDateTime } from "@/lib/format/dates";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { Alert, FormError } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reversements « À virer » (organisateurs payés par IBAN) : l'admin
 * télécharge le fichier SEPA, l'importe dans la banque de la plateforme,
 * puis marque les virements comme versés avec leur référence.
 */
export function BankTransfersPanel({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<ApiBankTransfer[] | null>(null);
  const [accountReady, setAccountReady] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const titleId = useId();

  const load = useCallback(async () => {
    try {
      const result = await listBankTransfers();
      setRows(result.data);
      setAccountReady(result.platform_account_ready);
      setSelected(new Set(result.data.filter((row) => !row.iban_held_until).map((row) => row.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les virements à effectuer.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    void load();
  }, [load]);

  if (rows === null) return null;
  if (rows.length === 0) {
    return notice ? <Alert tone="success" className="mb-8">{notice}</Alert> : null;
  }

  const chosen = rows.filter((row) => selected.has(row.id));
  const chosenTotal = chosen.reduce((sum, row) => sum + row.amount, 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await exportSepa(chosen.map((row) => row.id));
      download(result.filename, result.xml);
      setReference(result.message_id);
      setNotice(
        `Fichier ${result.filename} : ${result.count} virement${result.count > 1 ? "s" : ""}, ${euros.format(result.total)}.` +
          (result.skipped.length ? ` ${result.skipped.length} reversement(s) écarté(s) : ${result.skipped.map((s) => s.reason).join(", ")}.` : "") +
          " Importez-le dans votre banque, puis marquez les virements comme versés.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le fichier n'a pas pu être généré.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (reference.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmBankTransfers(chosen.map((row) => row.id), reference.trim());
      setConfirmOpen(false);
      setNotice(
        `${result.confirmed.length} virement${result.confirmed.length > 1 ? "s" : ""} marqué${result.confirmed.length > 1 ? "s" : ""} comme versé${result.confirmed.length > 1 ? "s" : ""}. Les organisateurs ont été prévenus par email.` +
          (result.failed.length ? ` ${result.failed.length} n'ont pas pu l'être.` : ""),
      );
      setReference("");
      await load();
      onChange?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Confirmation impossible, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  function askCancel(row: ApiBankTransfer) {
    setDialog({
      title: "Annuler ce virement ?",
      message: `Le reversement de ${euros.format(row.amount)} à ${row.organizer_name} redevient « En attente » et sera préparé de nouveau au prochain cycle. À utiliser si la banque a rejeté le virement.`,
      confirmLabel: "Annuler le virement",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif (ex. IBAN rejeté par la banque)",
      onConfirm: async (reason) => {
        setBusy(true);
        setError(null);
        try {
          await cancelBankTransfer(row.id, reason ?? "");
          setNotice("Virement annulé : le reversement est de nouveau en attente.");
          await load();
          onChange?.();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Annulation impossible.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <section className={cardClass("mb-8 p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-1">Virements à effectuer</h2>
          <p className="text-sm text-ink-5">Organisateurs payés par virement sur leur IBAN.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || chosen.length === 0 || !accountReady}
            onClick={handleExport}
            className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
          >
            Télécharger le fichier SEPA
          </button>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => setConfirmOpen(true)}
            className={buttonClass("primary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
          >
            Marquer comme versé{chosen.length > 1 ? `s (${chosen.length})` : ""}
          </button>
        </div>
      </div>

      {!accountReady ? (
        <Alert tone="warning" className="mb-4">
          Renseignez l&apos;IBAN de la plateforme dans les{" "}
          <Link href="/admin/parametres" className="underline">
            paramètres
          </Link>{" "}
          (Informations légales) pour générer le fichier SEPA.
        </Alert>
      ) : null}
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}
      {error ? <FormError>{error}</FormError> : null}

      <ul className="divide-y divide-hairline-1 rounded-xl ring-1 ring-inset ring-hairline-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label className="flex min-w-0 flex-1 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(row.id)}
                disabled={Boolean(row.iban_held_until)}
                onChange={() => toggle(row.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-1">
                  {row.organizer_name} — {row.event_name}
                </span>
                <span className="block font-mono text-xs text-ink-5">
                  {row.bank_owner_name ?? "Titulaire inconnu"} · {row.iban_masked ?? "Aucun IBAN"}
                </span>
                {row.offset_amount > 0 ? (
                  <span className="block text-xs text-ink-4">
                    {euros.format(row.net_amount)} moins {euros.format(row.offset_amount)} de montants dus
                  </span>
                ) : null}
                {row.iban_held_until ? (
                  <span className="block text-xs text-warning">
                    IBAN modifié récemment : virement possible à partir du{" "}
                    {longDateTime.format(new Date(row.iban_held_until))}
                  </span>
                ) : null}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-ink-1">{euros.format(row.amount)}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => askCancel(row)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2 hover:bg-hairline-1 disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-sm text-ink-4">
        Sélection : {chosen.length} virement{chosen.length > 1 ? "s" : ""} · {euros.format(chosenTotal)}
      </p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy={titleId} dismissible={!busy}>
        <div className="w-full max-w-md rounded-2xl border border-hairline-2 bg-card p-6 shadow-2xl">
          <h2 id={titleId} className="text-lg font-bold text-ink-1">
            Marquer {chosen.length > 1 ? `${chosen.length} virements` : "le virement"} comme versé
          </h2>
          <p className="mt-2 text-sm text-ink-4">
            À faire une fois le virement de {euros.format(chosenTotal)} émis par votre banque. Chaque organisateur
            reçoit un email avec la référence.
          </p>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            Référence du virement
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={140}
              placeholder="Référence donnée par la banque"
              className={fieldClass("px-4 py-3")}
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
            >
              Retour
            </button>
            <button
              type="button"
              disabled={busy || reference.trim().length < 3}
              onClick={handleConfirm}
              className={buttonClass("primary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
            >
              {busy ? "Enregistrement…" : "Confirmer"}
            </button>
          </div>
        </div>
      </Modal>
      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
