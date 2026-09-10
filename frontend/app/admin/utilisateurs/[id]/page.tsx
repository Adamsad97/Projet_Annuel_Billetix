"use client";

// Bug corrigé : page 100% maquette (adminUsers factices, multi-rôles
// "Acheteur"/"Organisateur"/"Admin" qui n'existe pas côté backend — un
// compte a un seul rôle) — câblée sur GET /admin/users/:id (+ profil
// organisateur/KYC quand applicable) et les actions de modération déjà
// exposées côté backend (suspend/unsuspend/unlock/reset-2fa/activate/
// change-role/kyc approve-reject).

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { DocumentGrid } from "@/components/admin/document-viewer";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import {
  activateUserAccount,
  approveOrganizerKyc,
  changeUserRole,
  getAdminUser,
  rejectOrganizerKyc,
  resetUserTwoFactor,
  suspendUser,
  unlockUserAccount,
  unsuspendUser,
  type ApiAdminUser,
  type ApiOrganizerProfile,
  type ApiUserRole,
} from "@/lib/api/admin";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";

const roleStyles: Record<ApiUserRole, string> = {
  BUYER: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30",
  ORGANIZER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  ADMIN: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  AGENT: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
};

const roleLabels: Record<ApiUserRole, string> = {
  BUYER: "Acheteur",
  ORGANIZER: "Organisateur",
  ADMIN: "Admin",
  AGENT: "Agent",
};

const kycStatusBadge: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: "✓ Identité vérifiée", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30" },
  SUBMITTED: { label: "⏳ Document soumis, à vérifier", className: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30" },
  PENDING: { label: "Aucun document soumis", className: "bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10" },
  REJECTED: { label: "✕ Document rejeté", className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30" },
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<ApiAdminUser | null | undefined>(undefined);
  const [organizerProfile, setOrganizerProfile] = useState<ApiOrganizerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);
  const [resetSent, setResetSent] = useState(false);

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
  }

  useEffect(load, [id]);

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

  function handleChangeRole(newRole: "BUYER" | "ORGANIZER" | "ADMIN") {
    if (!user || newRole === user.role) return;
    setDialog({
      title: `Changer le rôle en "${roleLabels[newRole]}" ?`,
      message: "Cette action est journalisée dans l'audit trail.",
      confirmLabel: "Changer",
      danger: newRole === "ADMIN",
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

  return (
    <AdminShell active="/admin/utilisateurs">
      <Link
        href="/admin/utilisateurs"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
      >
        ← Utilisateurs
      </Link>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      {user === undefined ? (
        <p className="text-center text-sm text-gray-500">Chargement…</p>
      ) : user === null ? (
        <div className="rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
          <div className="mb-3 text-4xl">👤</div>
          <h1 className="text-lg font-bold text-white">Utilisateur introuvable</h1>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-lg font-bold text-white">
                {`${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {user.first_name} {user.last_name}
                </h1>
                <p className="text-sm text-gray-500">
                  {user.email} · Membre depuis {dateFormatter.format(new Date(user.created_at))}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyles[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                  {user.is_suspended ? (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
                      Suspendu{user.suspension_reason ? ` — ${user.suspension_reason}` : ""}
                    </span>
                  ) : null}
                  {!user.is_email_verified ? (
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10">
                      Email non vérifié
                    </span>
                  ) : null}
                  {user.locked_until && new Date(user.locked_until) > new Date() ? (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      🔒 Verrouillé jusqu'au {dateFormatter.format(new Date(user.locked_until))}
                    </span>
                  ) : null}
                  {user.two_factor_enabled ? (
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10">
                      2FA activée
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {user.role !== "ADMIN" && user.role !== "AGENT" ? (
                <select
                  disabled={busy}
                  value={user.role}
                  onChange={(e) => handleChangeRole(e.target.value as "BUYER" | "ORGANIZER" | "ADMIN")}
                  className="rounded-full border border-white/15 bg-[#12101c] px-4 py-2 text-sm font-medium text-gray-200 focus:border-violet-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="BUYER">Acheteur</option>
                  <option value="ORGANIZER">Organisateur</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : null}

              <button
                type="button"
                disabled={busy || resetSent}
                onClick={handleResetPassword}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                {resetSent ? "✓ Lien envoyé" : "Réinitialiser le mot de passe"}
              </button>

              {!user.is_email_verified ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleActivate}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  Activer le compte
                </button>
              ) : null}

              {user.locked_until && new Date(user.locked_until) > new Date() ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleUnlock}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  Débloquer
                </button>
              ) : null}

              {user.two_factor_enabled ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResetTwoFactor}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  Réinitialiser la 2FA
                </button>
              ) : null}

              {user.is_suspended ? (
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
              )}
            </div>
          </div>

          {user.role === "ORGANIZER" ? (
            <div className="mb-6 rounded-2xl border border-white/5 bg-[#12101c] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-200">
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
                <p className="text-sm text-gray-500">
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
                    <p className="text-sm text-gray-500">Aucun document soumis pour le moment.</p>
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
        </>
      )}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </AdminShell>
  );
}
