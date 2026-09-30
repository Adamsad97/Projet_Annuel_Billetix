// Explication d'une ligne de reversement liée à la compensation : montant dû
// (frais des billets gratuits, remboursement après un versement), montant dû
// soldé, ou montants dus déduits d'un virement. Partagé organisateur / admin.

import { euros } from "@/lib/format/money";

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

const DUE = { label: "Montant dû", className: "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30" };
const SETTLED = { label: "Compensé", className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2" };

export function payoutSettlement(payout: SettlementSource): PayoutSettlement {
  const net = Number(payout.net_amount);
  const freeFees = Number(payout.free_ticket_fees_amount ?? 0);
  const offset = Number(payout.offset_amount ?? 0);

  if (net < 0) {
    if (payout.status === "COMPLETED" && payout.settled_by_payout_id) {
      return { badge: SETTLED, detail: "Réglé par déduction sur un reversement suivant." };
    }
    return {
      badge: DUE,
      detail:
        Number(payout.gross_amount) === 0 && freeFees > 0
          ? `Frais des billets gratuits : ${euros.format(-net)} restant à déduire du prochain reversement.`
          : `Remboursement survenu après un versement : ${euros.format(-net)} à déduire du prochain reversement.`,
    };
  }
  if (offset > 0) {
    return {
      badge: null,
      detail: `${euros.format(offset)} de montants dus déduits · virement de ${euros.format(Math.max(0, net - offset))}`,
    };
  }
  if (freeFees > 0) {
    return { badge: null, detail: `Dont ${euros.format(freeFees)} de frais de billets gratuits déduits.` };
  }
  return { badge: null, detail: null };
}
