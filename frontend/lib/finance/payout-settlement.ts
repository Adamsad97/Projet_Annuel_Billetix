// Explication d'une ligne de reversement liée à la compensation, partagée organisateur et admin.

import { euros } from "@/lib/format/money";
import { t, msg } from "@/lib/i18n/translate";

export interface SettlementSource {
  status: string;
  gross_amount: number | string;
  net_amount: number | string;
  free_ticket_fees_amount?: number | string;
  offset_amount?: number | string;
  settled_by_payout_id?: string | null;
}

export interface PayoutSettlement {
  /** Pastille : « Montant dû » ou « Compensé ». */
  badge: { label: string; className: string } | null;
  /** Précision affichée sous la ligne. */
  detail: string | null;
}

const DUE = { label: msg("Montant dû"), className: "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30" };
const SETTLED = { label: msg("Compensé"), className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" };

export function payoutSettlement(payout: SettlementSource): PayoutSettlement {
  const net = Number(payout.net_amount);
  const freeFees = Number(payout.free_ticket_fees_amount ?? 0);
  const offset = Number(payout.offset_amount ?? 0);

  if (net < 0) {
    if (payout.status === "COMPLETED" && payout.settled_by_payout_id) {
      return { badge: SETTLED, detail: t("Réglé par déduction sur un reversement suivant.") };
    }
    if (payout.settled_by_payout_id) {
      return { badge: SETTLED, detail: t("Déduit d'un virement en préparation.") };
    }
    return {
      badge: DUE,
      detail:
        Number(payout.gross_amount) === 0 && freeFees > 0
          ? t("Frais des billets gratuits : {value} restant à déduire du prochain reversement.", { value: euros.format(-net) })
          : t("Remboursement survenu après un versement : {value} à déduire du prochain reversement.", { value: euros.format(-net) }),
    };
  }
  if (offset > 0) {
    return {
      badge: null,
      detail: t("{value} de montants dus déduits · virement de {value2}", { value: euros.format(offset), value2: euros.format(Math.max(0, net - offset)) }),
    };
  }
  if (freeFees > 0) {
    return { badge: null, detail: t("Dont {value} de frais de billets gratuits déduits.", { value: euros.format(freeFees) }) };
  }
  return { badge: null, detail: null };
}
