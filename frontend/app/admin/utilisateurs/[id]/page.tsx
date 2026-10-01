"use client";

// Fiche compte câblée sur GET /admin/users/:id et les actions de modération.

import { use, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";
import { DocumentGrid } from "@/components/admin/document-viewer";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  activateUserAccount,
  approveOrganizerKyc,
  changeUserRole,
  getAdminUser,
  getUserOrders,
  getUserResales,
  getUserTransfers,
  rejectOrganizerKyc,
  resendOrderTicketsAsSupport,
  resetUserTwoFactor,
  suspendUser,
  unlockUserAccount,
  unsuspendUser,
  type ApiAdminUser,
  type ApiOrganizerProfile,
  type ApiAdminResale,
  type ApiTicketTransfer,
  type ApiUserRole,
} from "@/lib/api/admin";
import { requestPasswordReset } from "@/lib/api/auth";
import type { ApiOrder } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { resaleStatusBadge } from "@/lib/mappers/resale-mappers";
import { euros } from "@/lib/format/money";
import { dateTime, longDate as dateFormatter } from "@/lib/format/dates";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { MutedMessage } from "@/components/ui/muted-message";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const orderStatusLabel: Record<ApiOrder["status"], string> = {
  PENDING_PAYMENT: "En attente de paiement",
  CONFIRMED: "Payée",
  TICKETS_SENT: "Payée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const roleStyles: Record<ApiUserRole, string> = {
  BUYER: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
  ORGANIZER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  ADMIN: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  AGENT: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
  SUPER_ADMIN: "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30",
};

const roleLabels: Record<ApiUserRole, string> = {
  BUYER: "Acheteur",
  ORGANIZER: "Organisateur",
  ADMIN: "Admin",
  AGENT: "Agent",
  SUPER_ADMIN: "Super-admin",
};

const kycStatusBadge: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: "✓ Identité vérifiée", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  SUBMITTED: { label: "⏳ Document soumis, à vérifier", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  PENDING: { label: "Aucun document soumis", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" },
  REJECTED: { label: "✕ Document rejeté", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Actions sur un autre admin masquées hors SUPER_ADMIN ; lu en useEffect pour éviter un hydration mismatch.
  const [me, setMe] = useState<AuthUser | null>(null);
  const [transfers, setTransfers] = useState<ApiTicketTransfer[] | null>(null);
  const [resales, setResales] = useState<ApiAdminResale[] | null>(null);
  const [user, setUser] = useState<ApiAdminUser | null | undefined>(undefined);
  const [organizerProfile, setOrganizerProfile] = useState<ApiOrganizerProfile | null>(null);
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resentOrderId, setResentOrderId] = useState<string | null>(null);

  function load() {
    getAdminUser(id)
      .then((result) => {
        setUser(result.user);
        setOrganizerProfile(result.organizer_profile);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setUser(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Impossible de charger cet utilisateur.");
        }
      });
    getUserOrders(id)
      .then(setOrders)
      .catch(() => setOrders([]));
    getUserTransfers(id)
      .then(setTransfers)
      .catch(() => setTransfers([]));
    getUserResales(id)
      .then(setResales)
      .catch(() => setResales([]));
  }

  useEffect(load, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(getStoredUser());
  }, []);

  function handleResendTickets(order: ApiOrder) {
    setDialog({
      title: `Renvoyer les billets de ${order.reference} ?`,
      message: `Un nouvel email avec le(s) billet(s) sera envoyé à ${order.buyer_email}.`,
      confirmLabel: "Renvoyer",
      onConfirm: async () => {
        setBusy(true);
        try {
          await resendOrderTicketsAsSupport(order.id);
          setResentOrderId(order.id);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de renvoyer les billets.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function handleResetPassword() {
    if (!user) return;
    try {
      await requestPasswordReset(user.email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le lien de réinitialisation.");
    }
  }

  function handleSuspend() {
    if (!user) return;
    setDialog({
      title: `Suspendre ${user.first_name} ${user.last_name} ?`,
      message: "Le compte ne pourra plus se connecter tant que la suspension n'est pas levée. Le titulaire est notifié par email.",
      confirmLabel: "Suspendre",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif de la suspension…",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          await suspendUser(user.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de suspendre ce compte.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleUnsuspend() {
    if (!user) return;
    setDialog({
      title: `Réactiver ${user.first_name} ${user.last_name} ?`,
      message: "Le compte retrouve immédiatement l'accès à la plateforme.",
      confirmLabel: "Réactiver",
      onConfirm: async () => {
        setBusy(true);
        try {
          await unsuspendUser(user.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de réactiver ce compte.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleUnlock() {
    if (!user) return;
    setDialog({
      title: "Débloquer ce compte ?",
      message: "Le compte a été verrouillé après trop d'échecs de connexion. Il redevient immédiatement accessible.",
      confirmLabel: "Débloquer",
      onConfirm: async () => {
        setBusy(true);
        try {
          await unlockUserAccount(user.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de débloquer ce compte.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleResetTwoFactor() {
    if (!user) return;
    setDialog({
      title: "Réinitialiser la 2FA ?",
      message: "À utiliser uniquement si le titulaire a perdu son appareil ET ses codes de secours. Un motif est obligatoire.",
      confirmLabel: "Réinitialiser",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif (ex : perte de l'appareil confirmée par téléphone)…",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          await resetUserTwoFactor(user.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de réinitialiser la 2FA.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleActivate() {
    if (!user) return;
    setDialog({
      title: "Activer ce compte ?",
      message: "L'email n'a jamais été vérifié. Le compte devient utilisable sans que le titulaire clique sur le lien de vérification.",
      confirmLabel: "Activer",
      onConfirm: async () => {
        setBusy(true);
        try {
          await activateUserAccount(user.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible d'activer ce compte.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleChangeRole(newRole: ApiUserRole) {
    if (!user || newRole === user.role) return;
    setDialog({
      title: `Changer le rôle en "${roleLabels[newRole]}" ?`,
      message: "Cette action est journalisée dans l'audit trail.",
      confirmLabel: "Changer",
      danger: newRole === "ADMIN" || newRole === "SUPER_ADMIN",
      onConfirm: async () => {
        setBusy(true);
        try {
          await changeUserRole(user.id, newRole);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de changer le rôle.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleApproveKyc() {
    if (!user) return;
    setDialog({
      title: "Approuver le KYC de cet organisateur ?",
      message: "Il pourra publier des événements et recevoir des reversements.",
      confirmLabel: "Approuver",
      onConfirm: async () => {
        setBusy(true);
        try {
          await approveOrganizerKyc(user.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible d'approuver le KYC.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleRejectKyc() {
    if (!user) return;
    setDialog({
      title: "Rejeter le KYC de cet organisateur",
      message: "Le motif sera communiqué à l'organisateur par email.",
      confirmLabel: "Rejeter",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif du rejet…",
      onConfirm: async (reason) => {
        setBusy(true);
        try {
          await rejectOrganizerKyc(user.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de rejeter le KYC.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  const isSelf = !!me && !!user && me.id === user.id;
  const targetIsElevated = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  // Reflète assertCanManageTarget() côté auth-service : un ADMIN normal ne
  // peut agir ni sur un autre admin, ni sur son propre compte.
  const canManageTarget = !isSelf && (!targetIsElevated || me?.role === "SUPER_ADMIN");
  const canGrantElevatedRole = me?.role === "SUPER_ADMIN";

  return (
    <AdminShell active="/admin/utilisateurs">
      <BackLink href="/admin/utilisateurs">Utilisateurs</BackLink>

      {error ? (
        <Alert className="mb-6">{error}</Alert>
      ) : null}

      {user === undefined ? (
        <MutedMessage />
      ) : user === null ? (
        <div className={cardClass("p-8 text-center")}>
          <div className="mb-3 text-4xl">👤</div>
          <h1 className="text-lg font-bold text-ink-1">Utilisateur introuvable</h1>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar firstName={user.first_name} lastName={user.last_name} size="md" />
              <div>
                <h1 className="text-xl font-bold text-ink-1">
                  {user.first_name} {user.last_name}
                </h1>
                <p className="text-sm text-ink-5">
                  {user.email} · Membre depuis {dateFormatter.format(new Date(user.created_at))}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={roleStyles[user.role]}>
                    {roleLabels[user.role]}
                  </Badge>
                  {user.is_suspended ? (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
                      Suspendu{user.suspension_reason ? ` — ${user.suspension_reason}` : ""}
                    </span>
                  ) : null}
                  {!user.is_email_verified ? (
                    <span className="rounded-full bg-hairline-1 px-2.5 py-0.5 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">
                      Email non vérifié
                    </span>
                  ) : null}
                  {user.locked_until && new Date(user.locked_until) > new Date() ? (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      🔒 Verrouillé jusqu&apos;au {dateFormatter.format(new Date(user.locked_until))}
                    </span>
                  ) : null}
                  {user.two_factor_enabled ? (
                    <span className="rounded-full bg-hairline-1 px-2.5 py-0.5 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">
                      2FA activée
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {canManageTarget && user.role !== "AGENT" ? (
                <select
                  disabled={busy}
                  value={user.role}
                  onChange={(e) => handleChangeRole(e.target.value as ApiUserRole)}
                  className="rounded-full border border-hairline-3 bg-card px-4 py-2 text-sm font-medium text-ink-2 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="BUYER">Acheteur</option>
                  <option value="ORGANIZER">Organisateur</option>
                  {/* AGENT proposé parmi les rôles. */}
                  <option value="AGENT">Agent de contrôle</option>
                  {/* Accorder ADMIN ou SUPER_ADMIN est réservé au super admin. */}
                  {canGrantElevatedRole ? (
                    <>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super-admin</option>
                    </>
                  ) : null}
                </select>
              ) : null}

              {/* Bouton de réinitialisation masqué sur un compte admin. */}
              {canManageTarget ? (
                <button
                  type="button"
                  disabled={busy || resetSent}
                  onClick={handleResetPassword}
                  className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-50")}
                >
                  {resetSent ? "✓ Lien envoyé" : "Réinitialiser le mot de passe"}
                </button>
              ) : null}

              {!user.is_email_verified && canManageTarget ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleActivate}
                  className="rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 disabled:opacity-50"
                >
                  Activer le compte
                </button>
              ) : null}

              {user.locked_until && new Date(user.locked_until) > new Date() && canManageTarget ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleUnlock}
                  className="rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 disabled:opacity-50"
                >
                  Débloquer
                </button>
              ) : null}

              {user.two_factor_enabled && canManageTarget ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResetTwoFactor}
                  className="rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 disabled:opacity-50"
                >
                  Réinitialiser la 2FA
                </button>
              ) : null}

              {canManageTarget ? (
                user.is_suspended ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUnsuspend}
                    className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Réactiver
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSuspend}
                    className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                  >
                    Suspendre
                  </button>
                )
              ) : null}
            </div>
          </div>

          {user.role === "ORGANIZER" ? (
            <div id="kyc" className={cardClass("mb-6 scroll-mt-24 p-5")}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink-2">
                  Vérification d&apos;identité (KYC){organizerProfile ? ` — ${organizerProfile.display_name}` : ""}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    kycStatusBadge[organizerProfile?.kyc_status ?? "PENDING"].className
                  }`}
                >
                  {kycStatusBadge[organizerProfile?.kyc_status ?? "PENDING"].label}
                </span>
              </div>

              {!organizerProfile ? (
                <p className="text-sm text-ink-5">
                  Ce compte n&apos;a pas encore créé de profil organisateur (rôle changé manuellement, formulaire jamais rempli).
                </p>
              ) : (
                <>
                  {organizerProfile.kyc_rejected_reason ? (
                    <p className="mb-3 text-sm text-red-300">Motif du rejet : {organizerProfile.kyc_rejected_reason}</p>
                  ) : null}
                  {organizerProfile.kyc_document_url ? (
                    <DocumentGrid documents={[{ id: "kyc-doc", label: "Document d'identité", url: organizerProfile.kyc_document_url }]} />
                  ) : (
                    <p className="text-sm text-ink-5">Aucun document soumis pour le moment.</p>
                  )}

                  {organizerProfile.kyc_status === "SUBMITTED" ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleApproveKyc}
                        className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        ✓ Approuver
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleRejectKyc}
                        className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                      >
                        ✕ Rejeter
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className={cardClass("p-5")}>
            <h2 className="mb-4 text-sm font-semibold text-ink-2">Billets offerts et reçus</h2>
            {transfers === null ? (
              <p className="text-sm text-ink-5">Chargement…</p>
            ) : transfers.length === 0 ? (
              <p className="text-sm text-ink-5">Aucun billet offert ni reçu par ce compte.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {transfers.map((transfer) => {
                  const given = transfer.from_user_id === id;
                  return (
                    <div key={transfer.id} className="rounded-xl bg-hairline-1 px-4 py-3">
                      <p className="text-sm font-medium text-ink-1">
                        {given ? "🎁 Offert" : "📥 Reçu"} · {transfer.ticket_reference} · {transfer.event_name}
                        {transfer.status === "REVERTED" ? (
                          <span className="ml-2 text-xs font-medium text-success">Annulé — billet rendu à l&apos;expéditeur</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-5">
                        {given ? `À ${transfer.to_email}` : `De ${transfer.from_first_name} ${transfer.from_last_name} (${transfer.from_email})`}
                        {" · "}titulaire : {transfer.from_holder_first_name} {transfer.from_holder_last_name} →{" "}
                        {transfer.to_holder_first_name} {transfer.to_holder_last_name}
                      </p>
                      <p className="text-xs text-ink-6">
                        {dateTime.format(new Date(transfer.created_at))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cardClass("p-5")}>
            <h2 className="mb-4 text-sm font-semibold text-ink-2">Reventes</h2>
            {resales === null ? (
              <p className="text-sm text-ink-5">Chargement…</p>
            ) : resales.length === 0 ? (
              <p className="text-sm text-ink-5">Aucune revente pour ce compte.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {resales.map((resale) => {
                  const selling = resale.original_buyer_id === id;
                  const badge = resaleStatusBadge[resale.status];
                  const other = selling ? resale.buyer : resale.seller;
                  return (
                    <div key={resale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-hairline-1 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink-1">
                          {selling ? "🔄 Vendeur" : "🛒 Acheteur"} · {resale.ticket_reference ?? "—"} · {resale.event_name ?? "—"}
                        </p>
                        <p className="text-xs text-ink-5">
                          {euros.format(Number(resale.resale_price))}
                          {" · "}mis en vente le{" "}
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(resale.listed_at))}
                          {other ? ` · ${selling ? "acheté par" : "vendu par"} ${other.email}` : ""}
                        </p>
                      </div>
                      <Badge tone={badge.className} size="md" className="shrink-0 ring-1 ring-inset">
                        {badge.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cardClass("p-5")}>
            <h2 className="mb-4 text-sm font-semibold text-ink-2">Commandes</h2>
            {orders === null ? (
              <p className="text-sm text-ink-5">Chargement…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-ink-5">Aucune commande passée par ce compte.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {orders.map((order) => {
                  const canResend = order.status === "CONFIRMED" || order.status === "TICKETS_SENT";
                  return (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-hairline-1 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink-1">
                          {order.reference} · {order.event_name ?? "—"}
                        </p>
                        <p className="text-xs text-ink-5">
                          {orderStatusLabel[order.status]} · {euros.format(Number(order.total_amount_ttc))}
                        </p>
                      </div>
                      {canResend ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResendTickets(order)}
                          className="shrink-0 rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 disabled:opacity-50"
                        >
                          {resentOrderId === order.id ? "✓ Renvoyés" : "📧 Renvoyer les billets"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
