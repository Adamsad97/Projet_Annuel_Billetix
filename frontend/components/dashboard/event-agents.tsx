"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { Modal } from "@/components/ui/modal";
import { initialsOf } from "@/components/ui/avatar";
import {
  inviteEventAgentsBulk,
  listEventAgents,
  removeEventAgent,
  resendAgentInvitation,
  type ApiEventAgent,
  type BulkInviteResult,
} from "@/lib/api/agents";
import { ApiError } from "@/lib/api/http-error";
import { dateTime } from "@/lib/format/dates";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";

// Plafond d'un envoi — même valeur que AGENTS_BULK_MAX côté passerelle.
const MAX_ROWS = 20;

const fieldClassName = fieldClass("w-full px-3.5 py-2.5");

const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600"];

function initials(agent: ApiEventAgent): string {
  return initialsOf(agent.first_name, agent.last_name, agent.email?.[0]?.toUpperCase() ?? "?");
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </svg>
  );
}

function UsersIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M16.5 14.1c2.6.3 4.5 2.4 5 5.4" />
    </svg>
  );
}

interface Row {
  key: string;
  first_name: string;
  last_name: string;
  email: string;
  result?: BulkInviteResult;
}

/**
 * Fenêtre « Assigner des agents » : plusieurs invitations en un envoi.
 * Chaque ligne reçoit son propre résultat ; les lignes réussies disparaissent,
 * celles en erreur restent pour correction.
 */
function AssignAgentsDialog({
  eventId,
  eventTitle,
  onClose,
  onInvited,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const idPrefix = useId();
  const [counter, setCounter] = useState(1);
  const [rows, setRows] = useState<Row[]>([{ key: `${idPrefix}-0`, first_name: "", last_name: "", email: "" }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Envoi en partie réussi : message d'avertissement, pas d'erreur.
  const [partial, setPartial] = useState(false);
  const [done, setDone] = useState<BulkInviteResult[] | null>(null);

  function update(key: string, field: "first_name" | "last_name" | "email", value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value, result: undefined } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: `${idPrefix}-${counter}`, first_name: "", last_name: "", email: "" }]);
    setCounter((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setPartial(false);
    try {
      const { results } = await inviteEventAgentsBulk(
        eventId,
        rows.map((row) => ({ first_name: row.first_name.trim(), last_name: row.last_name.trim(), email: row.email.trim() })),
      );
      const succeeded = results.filter((result) => result.status !== "error");
      if (succeeded.length > 0) onInvited();
      const remaining = rows
        .map((row, index) => ({ ...row, result: results[index] }))
        .filter((row) => row.result?.status === "error");
      if (remaining.length === 0) {
        setDone(results);
      } else {
        setRows(remaining);
        setDone(null);
        setPartial(succeeded.length > 0);
        setError(
          succeeded.length > 0
            ? `${succeeded.length} invitation${succeeded.length > 1 ? "s" : ""} envoyée${succeeded.length > 1 ? "s" : ""}. Corrigez les lignes restantes.`
            : "Aucune invitation n'a pu être envoyée : corrigez les lignes ci-dessous.",
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'envoi a échoué, veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!sending}
      labelledBy={`${idPrefix}-title`}
      sheetOnMobile
      className="bg-slate-950/60 p-0 backdrop-blur-sm sm:p-6"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="relative bg-gradient-to-br from-blue-700 to-indigo-700 px-6 pb-6 pt-6 text-white">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <UsersIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 id={`${idPrefix}-title`} className="text-xl font-bold">Assigner des agents</h2>
              <p className="mt-0.5 truncate text-sm text-white/80">{eventTitle}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            disabled={sending}
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <ShieldIcon className="h-8 w-8" />
            </span>
            <div>
              <p className="text-lg font-bold text-ink-1">
                {done.length} agent{done.length > 1 ? "s" : ""} assigné{done.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-sm text-ink-5">
                {done.filter((r) => r.status === "invited").length > 0
                  ? "Les nouveaux agents reçoivent un email pour choisir leur mot de passe."
                  : "Les agents sont prévenus par email."}
              </p>
            </div>
            <ul className="w-full max-w-sm divide-y divide-hairline-1 rounded-2xl border border-hairline-1 text-left">
              {done.map((result) => (
                <li key={result.email} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="truncate text-ink-2">{result.email}</span>
                  <span className="shrink-0 text-xs font-medium text-emerald-600">
                    {result.status === "invited" ? "Invitation envoyée" : "Affecté"}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Terminer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <p className="mb-4 text-sm text-ink-4">
                Chaque agent reçoit un email : les nouveaux choisissent leur mot de passe, puis contrôlent les billets
                depuis la page « Scan » de leur téléphone. Une adresse dédiée est nécessaire (pas celle d&apos;un compte
                acheteur ou organisateur).
              </p>

              <div className="hidden grid-cols-[1fr_1fr_1.4fr_36px] gap-2 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-5 sm:grid">
                <span>Prénom</span>
                <span>Nom</span>
                <span>Email</span>
                <span />
              </div>

              <ul className="flex flex-col gap-3">
                {rows.map((row, index) => (
                  <li key={row.key} className="rounded-2xl border border-hairline-1 bg-hairline-1/40 p-2.5 sm:border-0 sm:bg-transparent sm:p-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_36px] sm:items-center">
                      <input
                        required
                        maxLength={100}
                        value={row.first_name}
                        onChange={(e) => update(row.key, "first_name", e.target.value)}
                        placeholder="Prénom"
                        aria-label={`Prénom de l'agent ${index + 1}`}
                        className={fieldClassName}
                      />
                      <input
                        required
                        maxLength={100}
                        value={row.last_name}
                        onChange={(e) => update(row.key, "last_name", e.target.value)}
                        placeholder="Nom"
                        aria-label={`Nom de l'agent ${index + 1}`}
                        className={fieldClassName}
                      />
                      <input
                        required
                        type="email"
                        maxLength={254}
                        value={row.email}
                        onChange={(e) => update(row.key, "email", e.target.value)}
                        placeholder="agent@exemple.fr"
                        aria-label={`Email de l'agent ${index + 1}`}
                        className={`${fieldClassName} col-span-2 sm:col-span-1 ${row.result?.status === "error" ? "border-red-500/60" : ""}`}
                      />
                      <button
                        type="button"
                        aria-label={`Retirer la ligne ${index + 1}`}
                        disabled={rows.length === 1 || sending}
                        onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                        className="col-span-2 flex h-9 items-center justify-center rounded-xl text-ink-5 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30 sm:col-span-1 sm:w-9"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {row.result?.status === "error" ? (
                      <p className="mt-1.5 px-1 text-xs text-danger">{row.result.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={rows.length >= MAX_ROWS || sending}
                onClick={addRow}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline-3 py-3 text-sm font-medium text-link transition-colors hover:border-blue-500 hover:bg-blue-500/5 disabled:opacity-40"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Ajouter un agent
                <span className="text-xs text-ink-5">({rows.length}/{MAX_ROWS})</span>
              </button>

              {error ? (
                <p
                  role="alert"
                  className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
                    partial ? "bg-amber-500/10 text-amber-700 ring-amber-500/30" : "bg-red-500/10 text-danger ring-red-500/25"
                  }`}
                >
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-hairline-1 bg-card px-6 py-4">
              <button
                type="button"
                disabled={sending}
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink-1"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-full bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Envoi…"
                  : `Envoyer ${rows.length > 1 ? `les ${rows.length} invitations` : "l'invitation"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

/**
 * Agents de contrôle de l'événement : liste (état de l'invitation), retrait,
 * et fenêtre « Assigner des agents » (ouverte aussi depuis l'en-tête de la
 * page via `inviteOpen`). Un agent retiré ne peut plus scanner ni télécharger
 * le paquet hors ligne.
 */
export function EventAgents({
  eventId,
  eventTitle,
  inviteOpen,
  onInviteOpenChange,
}: {
  eventId: string;
  eventTitle: string;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
}) {
  const [agents, setAgents] = useState<ApiEventAgent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  // Agent dont l'invitation est en cours de renvoi.
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(() => {
    listEventAgents(eventId)
      .then((list) => {
        setAgents(list);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Impossible de charger les agents."));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function askRemove(agent: ApiEventAgent) {
    const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email || "cet agent";
    setDialog({
      title: "Retirer l'agent",
      message: `${name} ne pourra plus contrôler les billets de cet événement, ni utiliser la liste des billets enregistrée sur son téléphone.`,
      confirmLabel: "Retirer",
      danger: true,
      onConfirm: async () => {
        try {
          await removeEventAgent(eventId, agent.user_id);
          setInfo(`${name} a été retiré de l'événement.`);
          load();
        } catch (err) {
          setInfo(err instanceof ApiError ? err.message : "Le retrait a échoué, veuillez réessayer.");
        }
      },
    });
  }

  async function resend(agent: ApiEventAgent) {
    const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email || "L'agent";
    setResending(agent.user_id);
    try {
      await resendAgentInvitation(eventId, agent.user_id);
      setInfo(`Nouvelle invitation envoyée à ${agent.email ?? name}.`);
    } catch (err) {
      setInfo(err instanceof ApiError ? err.message : "L'envoi a échoué, veuillez réessayer.");
      load();
    } finally {
      setResending(null);
    }
  }

  const count = agents?.length ?? 0;

  return (
    <section id="agents" className={cardClass("mb-8 scroll-mt-24 overflow-hidden shadow-sm")}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-900/25">
            <ShieldIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink-1">Agents de contrôle</h2>
            <p className="text-sm text-ink-5">
              {agents === null
                ? "Contrôle des billets à l'entrée"
                : `${count} agent${count > 1 ? "s" : ""} · scannent les billets à l'entrée depuis la page « Scan »`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onInviteOpenChange(true)}
          className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition-all hover:-translate-y-0.5 hover:opacity-95"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          Assigner des agents
        </button>
      </div>

      <div className="p-5">
        {info ? (
          <p role="status" className="mb-4 rounded-xl bg-hairline-1 px-4 py-2.5 text-sm text-ink-3">
            {info}
          </p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : agents === null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-hairline-1" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline-2 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
              <UsersIcon className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold text-ink-1">Aucun agent pour l&apos;instant</p>
              <p className="mt-1 max-w-md text-sm text-ink-5">
                Invitez les personnes qui contrôleront les billets à l&apos;entrée. Vous pouvez aussi scanner vous-même
                depuis la page « Scan ».
              </p>
            </div>
            <button
              type="button"
              onClick={() => onInviteOpenChange(true)}
              className="mt-1 rounded-full border border-blue-600/40 px-5 py-2 text-sm font-semibold text-link transition-colors hover:bg-blue-600/10"
            >
              Assigner des agents
            </button>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
              <li
                key={agent.user_id}
                className="group flex items-center gap-3 rounded-2xl border border-hairline-1 bg-hairline-1/40 p-3.5 transition-colors hover:border-hairline-3"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(agent.email ?? agent.user_id)}`}
                >
                  {initials(agent)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-1">
                    {[agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Compte introuvable"}
                  </p>
                  <p className="truncate text-xs text-ink-5">{agent.email ?? "—"}</p>
                  <p className="mt-1">
                    {agent.invitation_pending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Invitation envoyée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {agent.last_activity_at ? `Dernier scan · ${dateTime.format(new Date(agent.last_activity_at))}` : "Compte actif · aucun scan"}
                      </span>
                    )}
                  </p>
                  {agent.invitation_pending ? (
                    <button
                      type="button"
                      disabled={resending === agent.user_id}
                      onClick={() => resend(agent)}
                      className="mt-1.5 text-xs font-medium text-link transition-colors hover:text-link-hover disabled:opacity-50"
                    >
                      {resending === agent.user_id ? "Envoi…" : "Renvoyer l'invitation"}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => askRemove(agent)}
                  aria-label={`Retirer ${agent.first_name ?? agent.email ?? "l'agent"}`}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink-4 transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inviteOpen ? (
        <AssignAgentsDialog
          eventId={eventId}
          eventTitle={eventTitle}
          onClose={() => onInviteOpenChange(false)}
          onInvited={() => {
            setInfo(null);
            load();
          }}
        />
      ) : null}
      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
