// Présentation des entrées du journal d'audit (admin-service) : libellé
// français de l'action et résumé lisible de ses détails.

import type { ApiAuditLogEntry } from "@/lib/api/admin";
import { settingLabel, toInput } from "@/lib/admin/settings-catalog";
import { t, msg } from "@/lib/i18n/translate";

export const auditActionLabels: Record<string, string> = {
  USER_SUSPENDED: msg("Suspension de compte"),
  USER_UNSUSPENDED: msg("Levée de suspension"),
  USER_DELETED: msg("Suppression de compte"),
  USER_DATA_EXPORTED: msg("Export des données personnelles"),
  USER_ROLE_CHANGED: msg("Changement de rôle"),
  USER_ACCOUNT_UNLOCKED: msg("Déverrouillage de compte"),
  USER_ACCOUNT_ACTIVATED: msg("Activation de compte"),
  USER_2FA_RESET: msg("Réinitialisation 2FA"),
  USER_2FA_ENABLED: msg("2FA activée"),
  USER_2FA_DISABLED: msg("2FA désactivée"),
  USER_PASSWORD_RESET: msg("Réinitialisation du mot de passe"),
  KYC_APPROVED: msg("KYC validé"),
  KYC_REJECTED: msg("KYC rejeté"),
  EVENT_APPROVED: msg("Validation d'événement"),
  EVENT_REJECTED: msg("Refus d'événement"),
  EVENT_SUSPENDED: msg("Événement désactivé"),
  EVENT_NON_PROFIT_VERIFIED: msg("Statut non lucratif validé"),
  EVENT_NON_PROFIT_REJECTED: msg("Statut non lucratif refusé"),
  EVENT_CANCELED: msg("Annulation d'événement"),
  TICKET_INVALIDATED: msg("Invalidation de billet"),
  TICKET_QR_VIEWED: msg("Affichage du QR code"),
  TICKET_PDF_DOWNLOADED: msg("Téléchargement du billet PDF"),
  INVOICE_DOWNLOADED: msg("Téléchargement de facture"),
  TICKET_TRANSFERRED: msg("Billet offert"),
  TICKET_TRANSFER_REVERT_REQUESTED: msg("Annulation de transfert demandée"),
  TICKET_TRANSFER_REVERTED: msg("Transfert annulé (billet rendu)"),
  TICKET_TRANSFER_REVERT_REJECTED: msg("Annulation de transfert refusée"),
  PAYOUT_BLOCKED: msg("Blocage de reversement"),
  PAYOUT_UNBLOCKED: msg("Déblocage de reversement"),
  PAYOUT_EARLY_APPROVED: msg("Reversement anticipé accordé"),
  PAYOUT_PROCESSED_MANUALLY: msg("Reversement manuel"),
  PAYOUTS_SEPA_EXPORTED: msg("Fichier de virements SEPA"),
  PAYOUT_TRANSFER_CONFIRMED: msg("Virement confirmé"),
  PAYOUT_TRANSFER_CANCELLED: msg("Virement annulé"),
  REFUND_FORCED: msg("Remboursement forcé"),
  DISPUTE_RESOLVED: msg("Litige résolu"),
  PLATFORM_SETTING_UPDATED: msg("Paramètre modifié"),
  CUSTOM: msg("Action"),
};

export const auditActionFilters: { id: string; label: string }[] = [
  { id: "all", label: msg("Toutes les actions") },
  { id: "TICKET_TRANSFERRED", label: msg("Billets offerts") },
  { id: "TICKET_TRANSFER_REVERTED", label: msg("Transferts annulés") },
  { id: "TICKET_QR_VIEWED", label: msg("QR affichés") },
  { id: "TICKET_PDF_DOWNLOADED", label: msg("Billets téléchargés") },
  { id: "INVOICE_DOWNLOADED", label: msg("Factures téléchargées") },
];

const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/** Résumé d'une entrée : ce qui a été fait, sur quoi, pour qui. */
export function describeAuditLog(log: ApiAuditLogEntry): string {
  const meta = log.metadata ?? {};
  const reference = text(meta.reference);
  if (log.action === "PLATFORM_SETTING_UPDATED") {
    const key = text(meta.key) ?? log.entity_id ?? "?";
    const before = text(meta.previous_value);
    const after = text(meta.value);
    return `${settingLabel(key)} : ${before !== null ? toInput(key, before) : "?"} → ${after !== null ? toInput(key, after) : "?"}`;
  }
  if (log.action.startsWith("TICKET_TRANSFER")) {
    return [
      reference ? t("Billet {reference}", { reference }) : null,
      text(meta.event_name),
      `${text(meta.from_email) ?? log.performed_by_email ?? "?"} → ${text(meta.to_email) ?? "?"}`,
      meta.holder_before || meta.holder_after
        ? `titulaire : ${text(meta.holder_before) ?? "?"} → ${text(meta.holder_after) ?? "?"}`
        : null,
      meta.source === "PHONE" ? t("sur appel") : meta.source === "PLATFORM" ? t("sur demande en ligne") : null,
      text(meta.reason) ?? log.reason,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [reference ?? log.entity_id, log.reason].filter(Boolean).join(" · ") || "—";
}
