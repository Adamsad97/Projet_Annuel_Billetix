// Type du détail complet d'un billet — les données réelles viennent de
// ticket-service via apiTicketToDetail() (lib/mappers/profile-mappers.ts).

import type { TicketStatus } from "@/lib/mock/profile";

export interface TicketDetail {
  id: string;
  reference: string;
  eventName: string;
  venueName: string;
  address: string;
  city: string;
  dateLabel: string;
  timeLabel: string;
  holderName: string;
  buyerEmail: string;
  categoryName: string;
  priceLabel: string;
  status: TicketStatus;
  emoji: string;
  band: string;
  // URL du PDF réel (pdf-service) — absent tant qu'il n'est pas encore généré.
  pdfUrl?: string;
  // Valeur faciale brute et commande d'origine — nécessaires pour la remise
  // en revente (prix plafonné, cf. POST /tickets/:id/request-resale).
  unitPriceTtc: number;
  orderId: string;
  // Billet reçu en cadeau (la commande d'origine n'appartient pas au titulaire).
  receivedFrom?: { name: string; email: string; dateLabel: string };
  // Billet acheté en revente (la commande d'origine appartient au vendeur).
  resalePurchase?: { dateLabel: string; priceLabel: string };
}
