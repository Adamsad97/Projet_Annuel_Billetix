// Présentation des entrées du journal d'audit (admin-service) : libellé
// français de l'action et résumé lisible de ses détails.

import type { ApiAuditLogEntry } from "@/lib/api/admin";

export const auditActionLabels: Record<string, string> = {
  USER_SUSPENDED: "Suspension de compte",
  USER_UNSUSPENDED: "Levée de suspension",
  USER_DELETED: "Suppression de compte",
  USER_ROLE_CHANGED: "Changement de rôle",
  USER_ACCOUNT_UNLOCKED: "Déverrouillage de compte",
  USER_ACCOUNT_ACTIVATED: "Activation de compte",
  USER_2FA_RESET: "Réinitialisation 2FA",
  USER_2FA_ENABLED: "2FA activée",
  USER_2FA_DISABLED: "2FA désactivée",
  USER_PASSWORD_RESET: "Réinitialisation du mot de passe",
  KYC_APPROVED: "KYC validé",
  KYC_REJECTED: "KYC rejeté",
  EVENT_APPROVED: "Validation d'événement",
  EVENT_REJECTED: "Refus d'événement",
  EVENT_SUSPENDED: "Suspension d'événement",
  EVENT_NON_PROFIT_VERIFIED: "Statut non lucratif validé",
  EVENT_NON_PROFIT_REJECTED: "Statut non lucratif refusé",
  EVENT_CANCELED: "Annulation d'événement",
  TICKET_INVALIDATED: "Invalidation de billet",
  TICKET_QR_VIEWED: "Affichage du QR code",
  TICKET_PDF_DOWNLOADED: "Téléchargement du billet PDF",
  INVOICE_DOWNLOADED: "Téléchargement de facture",
  TICKET_TRANSFERRED: "Billet offert",
  TICKET_TRANSFER_REVERT_REQUESTED: "Annulation de transfert demandée",
  TICKET_TRANSFER_REVERTED: "Transfert annulé (billet rendu)",
  TICKET_TRANSFER_REVERT_REJECTED: "Annulation de transfert refusée",
  PAYOUT_BLOCKED: "Blocage de reversement",
  PAYOUT_UNBLOCKED: "Déblocage de reversement",
  PAYOUT_EARLY_APPROVED: "Reversement anticipé accordé",
  PAYOUT_PROCESSED_MANUALLY: "Reversement manuel",
  REFUND_FORCED: "Remboursement forcé",
  DISPUTE_RESOLVED: "Litige résolu",
  CUSTOM: "Action",
};

export const auditActionFilters: { id: string; label: string }[] = [
  { id: "all", label: "Toutes les actions" },
  { id: "TICKET_TRANSFERRED", label: "Billets offerts" },
  { id: "TICKET_TRANSFER_REVERTED", label: "Transferts annulés" },
  { id: "TICKET_QR_VIEWED", label: "QR affichés" },
  { id: "TICKET_PDF_DOWNLOADED", label: "Billets téléchargés" },
  { id: "INVOICE_DOWNLOADED", label: "Factures téléchargées" },
];

const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/** Résumé d'une entrée : ce qui a été fait, sur quoi, pour qui. */
export function describeAuditLog(log: ApiAuditLogEntry): string {
  const meta = log.metadata ?? {};
  const reference = text(meta.reference);
  if (log.action.startsWith("TICKET_TRANSFER")) {
    return [
      reference ? `Billet ${reference}` : null,
      text(meta.event_name),
      `${text(meta.from_email) ?? log.performed_by_email ?? "?"} → ${text(meta.to_email) ?? "?"}`,
      meta.holder_before || meta.holder_after
        ? `titulaire : ${text(meta.holder_before) ?? "?"} → ${text(meta.holder_after) ?? "?"}`
        : null,
      meta.source === "PHONE" ? "sur appel" : meta.source === "PLATFORM" ? "sur demande en ligne" : null,
      text(meta.reason) ?? log.reason,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [reference ?? log.entity_id, log.reason].filter(Boolean).join(" · ") || "—";
}
