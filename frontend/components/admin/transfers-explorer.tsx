"use client";

// Billets offerts entre comptes — données réelles (tickets.ticket_transfers).
// La liste n'affiche qu'un résumé (date, billet, événement, statut) : le
// détail (comptes, titulaires, contexte, demande d'annulation) ne s'ouvre
// qu'à la demande, via « Consulter ». Depuis la fiche, un admin peut annuler
// le transfert (billet rendu à l'expéditeur) sur appel de l'expéditeur, ou
// traiter sa demande faite depuis la plateforme (accepter / refuser).

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { DetailDialog, DetailSection } from "@/components/ui/detail-dialog";
import {
  listTicketTransfers,
  listTransferRevertRequests,
  rejectTransferRevert,
  revertTicketTransfer,
  type ApiTicketTransfer,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const PAGE_SIZE = 20;
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const views = [
  { id: "all", label: "Tous les transferts" },
  { id: "pending", label: "Demandes d'annulation" },
];
const sourceLabel = { PHONE: "sur appel", PLATFORM: "sur demande en ligne" } as const;
const badgeBase = "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

function StatusBadge({ transfer }: { transfer: ApiTicketTransfer }) {
  if (transfer.status === "REVERTED") {
    return <span className={`${badgeBase} bg-success/10 text-success ring-success/30`}>Annulé — billet rendu</span>;
  }
  if (transfer.pending_revert_request) {
    return <span className={`${badgeBase} bg-warning/10 text-warning ring-warning/30`}>Annulation demandée</span>;
  }
  return <span className={`${badgeBase} bg-hairline-1 text-ink-4 ring-hairline-2`}>Actif</span>;
}

export function TransfersExplorer() {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [transfers, setTransfers] = useState<ApiTicketTransfer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [selected, setSelected] = useState<ApiTicketTransfer | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const load =
        view === "pending"
          ? listTransferRevertRequests({ status: "PENDING", page, limit: PAGE_SIZE }).then((result) => ({
              data: result.data
                .filter((request) => request.transfer)
                .map((request) => ({ ...request.transfer!, pending_revert_request: request })),
              total: result.total,
            }))
          : listTicketTransfers({ q: search || undefined, page, limit: PAGE_SIZE });
      load
        .then((result) => {
          setTransfers(result.data);
          setTotal(result.total);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les transferts."));
    }, 300);
    return () => clearTimeout(timeout);
  }, [view, search, page, version]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      setVersion((current) => current + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'action a échoué, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  function askRevert(transfer: ApiTicketTransfer) {
    const request = transfer.pending_revert_request;
    setSelected(null);
    setDialog({
      title: request ? "Accepter la demande d'annulation ?" : "Annuler ce transfert ?",
      message:
        `Le billet ${transfer.ticket_reference} sera rendu à ${transfer.from_first_name} ${transfer.from_last_name} ` +
        `(${transfer.from_email}), au nom de ${transfer.from_holder_first_name} ${transfer.from_holder_last_name}. ` +
        `${transfer.to_email} le perdra et son QR code ne sera plus valable. Les deux seront prévenus par email.`,
      confirmLabel: request ? "Accepter et rendre le billet" : "Annuler le transfert",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: request
        ? "Motif (ex. demande justifiée : erreur de destinataire)…"
        : "Motif et contexte de l'appel (date, vérification d'identité…)",
      onConfirm: (reason) =>
        run(
          () =>
            revertTicketTransfer(transfer.id, {
              reason: reason ?? "",
              source: request ? "PLATFORM" : "PHONE",
              request_id: request?.id,
            }),
          `Transfert ${transfer.ticket_reference} annulé : billet rendu à ${transfer.from_email}.`,
        ),
    });
  }

  function askReject(transfer: ApiTicketTransfer) {
    const request = transfer.pending_revert_request;
    if (!request) return;
    setSelected(null);
    setDialog({
      title: "Refuser la demande d'annulation ?",
      message: `Le billet ${transfer.ticket_reference} restera chez ${transfer.to_email}. Le motif sera transmis à ${transfer.from_email}.`,
      confirmLabel: "Refuser la demande",
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du refus (transmis à l'expéditeur)…",
      onConfirm: (reason) =>
        run(() => rejectTransferRevert(request.id, reason ?? ""), `Demande sur ${transfer.ticket_reference} refusée.`),
    });
  }

  const request = selected?.pending_revert_request ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          options={views}
          active={view}
          onChange={(value) => {
            setView(value);
            setPage(1);
          }}
        />
        {view === "all" ? (
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Référence, email ou événement…"
          />
        ) : null}
      </div>
      <p className="text-sm text-ink-5">
        {total} {view === "pending" ? `demande${total > 1 ? "s" : ""} en attente` : `transfert${total > 1 ? "s" : ""}`}
      </p>

      {notice ? (
        <p className="rounded-xl bg-success/10 px-4 py-2.5 text-sm text-success ring-1 ring-inset ring-success/30">{notice}</p>
      ) : null}
      {error && transfers !== null ? (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger ring-1 ring-inset ring-danger/30">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-hairline-1 bg-card">
        {transfers === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : transfers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-5">{view === "pending" ? "Aucune demande en attente." : "Aucun transfert."}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline-1 text-xs uppercase tracking-wide text-ink-5">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Billet</th>
                <th className="px-5 py-3 font-semibold">Événement</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-hairline-1 last:border-b-0">
                  <td className="whitespace-nowrap px-5 py-3 text-ink-3">{dateTimeFormatter.format(new Date(transfer.created_at))}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-ink-1">{transfer.ticket_reference}</td>
                  <td className="px-5 py-3 text-ink-3">{transfer.event_name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge transfer={transfer} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(transfer)}
                      className="whitespace-nowrap rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
                    >
                      Consulter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-ink-5">
            Page {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      ) : null}

      <DetailDialog
        open={selected !== null}
        title={selected ? `Transfert du billet ${selected.ticket_reference}` : ""}
        subtitle={selected ? `${selected.event_name} · ${selected.ticket_category_name}` : undefined}
        onClose={() => setSelected(null)}
        footer={
          selected && selected.status !== "REVERTED" ? (
            <>
              {request ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => askReject(selected)}
                  className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
                >
                  Refuser la demande
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => askRevert(selected)}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {request ? "Accepter et rendre le billet" : "Annuler le transfert"}
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <>
            <DetailSection title="Statut">
              <StatusBadge transfer={selected} />
              <p className="mt-2 text-ink-4">Offert le {dateTimeFormatter.format(new Date(selected.created_at))}</p>
            </DetailSection>
            <DetailSection title="Expéditeur">
              <p className="text-ink-1">
                {selected.from_first_name} {selected.from_last_name}
              </p>
              <p className="text-ink-5">{selected.from_email}</p>
            </DetailSection>
            <DetailSection title="Bénéficiaire">
              <p className="text-ink-1">{selected.to_email}</p>
            </DetailSection>
            <DetailSection title="Titulaire du billet">
              <p>
                {selected.from_holder_first_name} {selected.from_holder_last_name} →{" "}
                <span className="font-medium text-ink-1">
                  {selected.to_holder_first_name} {selected.to_holder_last_name}
                </span>
              </p>
            </DetailSection>
            <DetailSection title="Contexte du transfert">
              <p className="text-ink-4">IP : {selected.ip_address ?? "—"}</p>
              <p className="break-words text-ink-4">Appareil : {selected.user_agent ?? "—"}</p>
            </DetailSection>
            {request ? (
              <DetailSection title="Demande d'annulation de l'expéditeur">
                <p className="text-ink-4">Le {dateTimeFormatter.format(new Date(request.created_at))}</p>
                <p className="mt-1 text-ink-1">« {request.reason} »</p>
              </DetailSection>
            ) : null}
            {selected.status === "REVERTED" ? (
              <DetailSection title="Annulation">
                <p className="text-ink-4">
                  {selected.reverted_at ? `Le ${dateTimeFormatter.format(new Date(selected.reverted_at))}` : null}
                  {selected.revert_source ? ` · ${sourceLabel[selected.revert_source]}` : null}
                </p>
                <p className="text-ink-4">Par {selected.reverted_by_email ?? "—"}</p>
                {selected.revert_reason ? <p className="mt-1 text-ink-1">« {selected.revert_reason} »</p> : null}
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </DetailDialog>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
