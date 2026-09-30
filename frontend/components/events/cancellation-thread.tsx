"use client";

// Échange sur une demande d'annulation ou de report : motif (et nouvelle date
// proposée) de l'organisateur, messages des deux parties et zone de réponse
// tant que la demande est en attente.
// Les actions (accepter, refuser, retirer) sont fournies par la page.

import { useState, type ReactNode } from "react";
import { cancellationStatusLabels, changeRequestKindLabels, type ApiCancellationRequest } from "@/lib/api/cancellation";
import { dateTime, fullDateTime } from "@/lib/format/dates";
import { cardClass } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fieldClass } from "@/components/ui/field";

export function CancellationThread({
  request,
  viewer,
  onReply,
  actions,
}: {
  request: ApiCancellationRequest;
  /** Qui regarde : ses messages s'affichent à droite. */
  viewer: "ORGANIZER" | "ADMIN";
  onReply?: (message: string) => Promise<void>;
  actions?: ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const status = cancellationStatusLabels[request.status];
  const kind = changeRequestKindLabels[request.kind ?? "CANCELLATION"];
  const postponement = request.kind === "POSTPONEMENT";
  const pending = request.status === "PENDING";

  async function send() {
    const message = draft.trim();
    if (!message || !onReply) return;
    setSending(true);
    try {
      await onReply(message);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  const bubble = (mine: boolean) =>
    mine ? "ml-auto bg-blue-600/15 ring-blue-500/30" : "mr-auto bg-hairline-1 ring-hairline-2";
  const author = (role: "ORGANIZER" | "ADMIN") =>
    role === viewer ? "Vous" : role === "ADMIN" ? "Administration BilleTix" : request.organizer_name ?? "Organisateur";

  return (
    <div className={cardClass()}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-1 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={kind.className}>{kind.badge}</Badge>
          <p className="text-sm text-ink-4">Demande du {dateTime.format(new Date(request.created_at))}</p>
        </div>
        <Badge tone={status.className}>{status.label}</Badge>
      </div>

      {postponement ? (
        <p className="border-b border-hairline-1 px-5 py-3 text-sm text-ink-2">
          <span className="font-semibold text-ink-1">Nouvelle date proposée : </span>
          {request.new_start_date ? fullDateTime.format(new Date(request.new_start_date)) : "à venir (fixée plus tard par l'organisateur)"}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ring-1 ring-inset ${bubble(viewer === "ORGANIZER")}`}>
          <p className="mb-1 text-xs font-semibold text-ink-4">{author("ORGANIZER")} · motif de la demande</p>
          <p className="whitespace-pre-line text-ink-1">{request.reason}</p>
        </div>
        {request.messages.map((message) => (
          <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ring-1 ring-inset ${bubble(viewer === message.author_role)}`}>
            <p className="mb-1 text-xs font-semibold text-ink-4">
              {author(message.author_role)} · {dateTime.format(new Date(message.created_at))}
            </p>
            <p className="whitespace-pre-line text-ink-1">{message.message}</p>
          </div>
        ))}
      </div>

      {pending && onReply ? (
        <div className="border-t border-hairline-1 px-5 py-4">
          <label className="sr-only" htmlFor={`reply-${request.id}`}>
            Votre message
          </label>
          <textarea
            id={`reply-${request.id}`}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Votre message…"
            className={fieldClass("w-full resize-none px-3 py-2")}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
