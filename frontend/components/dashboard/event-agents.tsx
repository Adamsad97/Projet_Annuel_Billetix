"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { inviteEventAgent, listEventAgents, removeEventAgent, type ApiEventAgent } from "@/lib/api/agents";
import { ApiError } from "@/lib/api/http-error";

const fieldClassName =
  "rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Agents de contrôle de l'événement : invitation par email (compte agent
 * créé au besoin), liste avec l'état de l'invitation, retrait. Un agent
 * retiré ne peut plus scanner ni télécharger le paquet hors ligne.
 */
export function EventAgents({ eventId }: { eventId: string }) {
  const [agents, setAgents] = useState<ApiEventAgent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

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

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setFormError(null);
    setInfo(null);
    try {
      const result = await inviteEventAgent(eventId, {
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      setInfo(
        result.account_created
          ? `Invitation envoyée à ${form.email.trim()} : l'agent choisit son mot de passe depuis l'email reçu.`
          : `${form.first_name.trim()} est affecté à l'événement et prévenu par email.`,
      );
      setForm({ email: "", first_name: "", last_name: "" });
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "L'invitation a échoué, veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  function askRemove(agent: ApiEventAgent) {
    const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email || "cet agent";
    setDialog({
      title: "Retirer l'agent",
      message: `${name} ne pourra plus contrôler les billets de cet événement, ni télécharger son paquet hors ligne.`,
      confirmLabel: "Retirer",
      danger: true,
      onConfirm: async () => {
        try {
          await removeEventAgent(eventId, agent.user_id);
          setInfo(`${name} a été retiré.`);
          load();
        } catch (err) {
          setFormError(err instanceof ApiError ? err.message : "Le retrait a échoué, veuillez réessayer.");
        }
      },
    });
  }

  return (
    <section className="mb-8 rounded-2xl border border-hairline-1 bg-card p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink-1">Agents de contrôle</h2>
        <p className="mt-0.5 text-sm text-ink-5">
          Personnes autorisées à scanner les billets à l&apos;entrée, depuis la page « Scan » de leur téléphone. Chaque
          agent a son propre compte.
        </p>
      </div>

      {loadError ? (
        <p className="mb-4 text-sm text-danger">{loadError}</p>
      ) : agents === null ? (
        <p className="mb-4 text-sm text-ink-5">Chargement…</p>
      ) : agents.length === 0 ? (
        <p className="mb-4 rounded-xl bg-hairline-1 px-4 py-3 text-sm text-ink-4">
          Aucun agent pour l&apos;instant. Vous pouvez aussi scanner vous-même depuis la page « Scan ».
        </p>
      ) : (
        <ul className="mb-5 divide-y divide-hairline-1 rounded-xl border border-hairline-1">
          {agents.map((agent) => (
            <li key={agent.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-1">
                  {[agent.first_name, agent.last_name].filter(Boolean).join(" ") || "Compte introuvable"}
                </p>
                <p className="truncate text-xs text-ink-5">{agent.email ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                {agent.invitation_pending ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600">
                    Invitation envoyée
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    {agent.last_activity_at ? `Actif · ${dateTime.format(new Date(agent.last_activity_at))}` : "Compte actif"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => askRemove(agent)}
                  className="text-xs font-medium text-ink-4 transition-colors hover:text-red-500"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleInvite} className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink-2">Inviter un agent</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            required
            maxLength={100}
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            placeholder="Prénom"
            aria-label="Prénom de l'agent"
            className={fieldClassName}
          />
          <input
            required
            maxLength={100}
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            placeholder="Nom"
            aria-label="Nom de l'agent"
            className={fieldClassName}
          />
        </div>
        <input
          required
          type="email"
          maxLength={254}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="adresse@exemple.fr"
          aria-label="Adresse email de l'agent"
          className={fieldClassName}
        />
        <p className="text-xs text-ink-5">
          Utilisez une adresse dédiée au contrôle : une adresse déjà liée à un compte acheteur ou organisateur est
          refusée.
        </p>
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="text-sm text-success">
            {info}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={sending}
          className="self-end rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Envoi…" : "Envoyer l'invitation"}
        </button>
      </form>

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
