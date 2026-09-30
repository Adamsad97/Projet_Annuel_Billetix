import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

interface IssuedCreditNote {
  credit_note: {
    id: string;
    number: string;
    amount_ht: number | string;
    tva_amount: number | string;
    fees_amount: number | string;
    amount_ttc: number | string;
    reason: string;
    created_at: string;
  };
  order: {
    reference: string;
    event_name: string;
    billing_first_name: string;
    billing_last_name: string;
    billing_email: string;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_postal_code: string | null;
    billing_country: string | null;
  };
}

/**
 * Avoir d'un remboursement : enregistré par order-service (numéro continu,
 * montants au prorata de la facture), puis mis en PDF par pdf-service. Appelé
 * après chaque remboursement réussi (annulation, report, admin, revente).
 */
@Injectable()
export class CreditNoteIssuer {
  private readonly logger = new Logger(CreditNoteIssuer.name);

  constructor(
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PDF_SERVICE") private readonly pdfClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
  ) {}

  /** Sans bloquer ni faire échouer le remboursement, déjà effectué. */
  issueInBackground(orderId: string, amountTtc: number | undefined, reason: string): void {
    this.issue(orderId, amountTtc, reason).catch((err) =>
      this.logger.error(`Avoir de la commande ${orderId} non émis : ${(err as Error)?.message}`),
    );
  }

  /** amountTtc absent : remboursement total (solde de la facture non encore couvert). */
  async issue(orderId: string, amountTtc: number | undefined, reason: string): Promise<string | null> {
    const issued = await firstValueFrom(
      this.orderClient.send<IssuedCreditNote | null>("order.issue_credit_note", {
        order_id: orderId,
        amount_ttc: amountTtc,
        reason,
      }),
    );
    // Réservation gratuite (sans facture) ou facture déjà entièrement couverte.
    if (!issued) return null;

    const config = await firstValueFrom(
      this.adminClient.send<{
        tva_rate: number;
        platform_legal_name: string;
        platform_siret: string;
        platform_vat_number: string;
        platform_address: string;
      }>("admin.get_platform_config", {}),
    );
    const { credit_note: note, order } = issued;
    this.pdfClient.emit("pdf.generate_credit_note", {
      credit_note_id: note.id,
      number: note.number,
      issued_at: new Date(note.created_at).toISOString(),
      invoice_reference: order.reference,
      reason: note.reason,
      event_name: order.event_name,
      tva_rate: config.tva_rate,
      billing_first_name: order.billing_first_name,
      billing_last_name: order.billing_last_name,
      billing_email: order.billing_email,
      billing_address_line1: order.billing_address_line1,
      billing_address_line2: order.billing_address_line2,
      billing_city: order.billing_city,
      billing_postal_code: order.billing_postal_code,
      billing_country: order.billing_country,
      // Colonnes decimal renvoyées en texte par Postgres.
      amount_ht: Number(note.amount_ht),
      tva_amount: Number(note.tva_amount),
      fees_amount: Number(note.fees_amount),
      amount_ttc: Number(note.amount_ttc),
      platform_legal_name: config.platform_legal_name,
      platform_siret: config.platform_siret,
      platform_vat_number: config.platform_vat_number,
      platform_address: config.platform_address,
    });
    this.logger.log(`Avoir ${note.number} émis pour la commande ${orderId}`);
    return note.number;
  }
}
