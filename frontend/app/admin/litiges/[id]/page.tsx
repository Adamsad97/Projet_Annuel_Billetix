"use client";

// Fiche d'un litige : réclamation de l'acheteur, commande, billets, paiement
// et avoirs ; prise en charge, invalidation d'un billet et décision.

import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { BackLink } from "@/components/ui/back-link";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { Badge } from "@/components/ui/badge";
import { cardClass } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { DisputeDecisionDialog } from "@/components/admin/dispute-decision-dialog";
import {
  getDisputeDetail,
  invalidateTicketAsAdmin,
  resolveDispute,
  startDisputeReview,
  type ApiDisputeDetail,
  type ResolveDisputeInput,
} from "@/lib/api/admin";
import { disputeReasonLabels, disputeStatusBadge, rawTicketStatusBadge } from "@/lib/constants/admin-disputes";
import { ApiError } from "@/lib/api/http-error";
import { dateTime, longDate } from "@/lib/format/dates";
import { euros } from "@/lib/format/money";
import { t } from "@/lib/i18n/translate";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cardClass("mb-6 overflow-hidden")}>
      <h2 className="border-b border-hairline-1 px-5 py-3 text-sm font-semibold text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-hairline-1 px-5 py-2.5 text-sm last:border-b-0">
      <span className="text-ink-5">{label}</span>
      <span className="text-right text-ink-1">{children}</span>
    </div>
  );
}

export default function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ApiDisputeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(() => {
    getDisputeDetail(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger le litige.")));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setInfo(done);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("L'action a échoué, veuillez réessayer."));
    } finally {
      setBusy(false);
    }
  }

  function askInvalidate(ticket: ApiDisputeDetail["tickets"][number]) {
    setDialog({
      title: t("Invalider le billet {reference}", { reference: ticket.reference }),
      message: t("Le billet ne permettra plus d'entrer à l'événement. Aucun remboursement n'est effectué par cette action."),
      confirmLabel: t("Invalider le billet"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Motif (conservé dans le journal d'administration)"),
      onConfirm: (reason) => run(() => invalidateTicketAsAdmin(ticket.id, reason!), t("Billet {reference} invalidé.", { reference: ticket.reference })),
    });
  }

  async function decide(input: ResolveDisputeInput) {
    await resolveDispute(id, input);
    setDeciding(false);
    setInfo(t("Décision enregistrée : l'acheteur et l'organisateur ont été prévenus."));
    load();
  }

  const d = detail?.dispute;
  const open = d?.status === "OPEN" || d?.status === "UNDER_REVIEW";
  const refundable = detail ? Math.max(0, detail.order.total_amount_ttc - detail.order.refunded_amount) : 0;

  return (
    <AdminShell active="/admin/litiges">
      <BackLink href="/admin/litiges">{t("Litiges")}</BackLink>

      {error ? <Alert className="mb-6">{error}</Alert> : null}
      {info ? (
        <Alert tone="success" className="mb-6">
          {info}
        </Alert>
      ) : null}

      {!detail || !d ? (
        error ? null : <MutedMessage />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-ink-1">{t(disputeReasonLabels[d.reason] ?? d.reason)}</h1>
                <Badge tone={disputeStatusBadge[d.status].className} size="md">
                  {t(disputeStatusBadge[d.status].label)}
                </Badge>
                {d.stripe_dispute_id ? (
                  <Badge tone="bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30" size="md">{t("Contestation bancaire")}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-ink-5">{t("Commande {reference} · ouvert le {value}", { reference: detail.order.reference, value: dateTime.format(new Date(d.created_at)) })}</p>
            </div>
            {open ? (
              <div className="flex flex-wrap gap-2">
                {d.status === "OPEN" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => startDisputeReview(id), t("Litige pris en charge."))}
                    className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
                  >{t("Prendre en charge")}</button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeciding(true)}
                  className={buttonClass("primary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
                >{t("Trancher")}</button>
              </div>
            ) : null}
          </div>

          <Section title={d.stripe_dispute_id ? t("Contestation") : t("Réclamation de l'acheteur")}>
            <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-2">{d.description || t("Aucun message joint.")}</p>
            {d.resolution_notes ? (
              <div className="border-t border-hairline-1 px-5 py-4 text-sm">
                <p className="font-semibold text-ink-1">{d.resolved_at ? t("Décision du {date}", { date: dateTime.format(new Date(d.resolved_at)) }) : t("Décision")}</p>
                <p className="mt-1 whitespace-pre-line text-ink-3">{d.resolution_notes}</p>
              </div>
            ) : null}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t("Commande")}>
              <Row label={t("Référence")}>{detail.order.reference}</Row>
              <Row label={t("Événement")}>
                <Link href={`/admin/evenements/${detail.order.event_id}`} className="text-link hover:text-link-hover">
                  {detail.order.event_name}
                </Link>
                {detail.order.event_start_at ? ` · ${longDate.format(new Date(detail.order.event_start_at))}` : ""}
              </Row>
              <Row label={t("Acheteur")}>
                <Link href={`/admin/utilisateurs/${detail.order.buyer_id}`} className="text-link hover:text-link-hover">
                  {detail.order.buyer_name}
                </Link>{" "}
                · {detail.order.buyer_email}
              </Row>
              <Row label={t("Montant payé")}>{euros.format(detail.order.total_amount_ttc)}</Row>
              <Row label={t("Déjà remboursé")}>{euros.format(detail.order.refunded_amount)}</Row>
              <Row label={t("Statut")}>{detail.order.status}</Row>
              <Row label={t("Commandée le")}>{dateTime.format(new Date(detail.order.created_at))}</Row>
            </Section>

            <Section title={t("Paiement")}>
              {detail.payment ? (
                <>
                  <Row label={t("Prestataire")}>{detail.payment.provider}</Row>
                  <Row label={t("Statut")}>{detail.payment.status}</Row>
                  <Row label={t("Montant")}>{euros.format(detail.payment.amount)}</Row>
                  <Row label={t("Remboursé")}>{euros.format(detail.payment.refunded_amount)}</Row>
                </>
              ) : (
                <MutedMessage variant="list">{t("Aucun paiement enregistré.")}</MutedMessage>
              )}
              {detail.credit_notes.length > 0 ? (
                <div className="border-t border-hairline-1 px-5 py-3 text-sm">
                  <p className="mb-1 font-semibold text-ink-2">{t("Avoirs émis")}</p>
                  {detail.credit_notes.map((note) => (
                    <p key={note.number} className="text-ink-4">
                      {note.number} · {euros.format(note.amount_ttc)} · {note.reason}
                    </p>
                  ))}
                </div>
              ) : null}
            </Section>
          </div>

          <Section title={t("Billets ({count})", { count: detail.tickets.length })}>
            {detail.tickets.length === 0 ? (
              <MutedMessage variant="list">{t("Aucun billet pour cette commande.")}</MutedMessage>
            ) : (
              detail.tickets.map((ticket) => {
                const badge = rawTicketStatusBadge[ticket.status] ?? { label: ticket.status, className: "" };
                const active = ["GENERATED", "SENT", "FOR_RESALE"].includes(ticket.status);
                return (
                  <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-1 px-5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-1">
                        {ticket.reference} · {ticket.category}
                      </p>
                      <p className="text-xs text-ink-5">{t("Détenteur : {holder}", { holder: ticket.holder })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={badge.className}>{t(badge.label)}</Badge>
                      {active ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => askInvalidate(ticket)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >{t("Invalider")}</button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </Section>

          <DisputeDecisionDialog
            key={deciding ? "open" : "closed"}
            open={deciding}
            refundable={refundable}
            onClose={() => setDeciding(false)}
            onSubmit={decide}
          />
          <ActionDialog state={dialog} onClose={() => setDialog(null)} />
        </>
      )}
    </AdminShell>
  );
}
