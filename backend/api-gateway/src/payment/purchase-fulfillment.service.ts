import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { RealtimePublisher } from "../realtime/realtime.publisher";
import { UploadService } from "../upload/upload.service";
import { DEFAULT_EVENT_TIMEZONE, formatEventDate } from "../common/event-date";

/** Traitement post-achat (billets, facture, notifications, reversement), payant comme gratuit. */

/** Libellés des moyens de paiement affichés sur la facture envoyée par email. */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE: "Carte bancaire",
  FREE: "Gratuit",
};

@Injectable()
export class PurchaseFulfillmentService {
  private readonly logger = new Logger(PurchaseFulfillmentService.name);

  constructor(
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("PDF_SERVICE") private readonly pdfClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    private readonly realtime: RealtimePublisher,
    private readonly uploads: UploadService,
  ) {}

  async confirmAndFulfill(
    orderId: string,
    paymentIntentId: string,
  ): Promise<void> {
    const { order, items } = (await firstValueFrom(
      this.orderClient.send("order.get", { id: orderId }),
    )) as {
      order: {
        id: string;
        reference: string;
        buyer_id: string;
        buyer_email: string;
        buyer_first_name: string;
        buyer_last_name: string;
        total_amount_ht: number;
        total_amount_ttc: number;
        total_commission: number;
        total_payment_fees: number;
        discount_amount: number;
        free_ticket_fees: number;
        is_resale: boolean;
        organizer_id?: string;
        event_id: string;
        event_name: string;
        event_start_at: string;
        event_end_at?: string;
        event_venue_name: string;
        event_venue_address: string;
        event_city: string;
        event_poster_url?: string;
        artist_name: string;
        artist_description?: string;
        billing_first_name: string;
        billing_last_name: string;
        billing_email: string;
        billing_address_line1: string;
        billing_address_line2?: string | null;
        billing_city: string;
        billing_postal_code: string;
        billing_country: string;
        payment_method: string;
      };
      items: {
        id: string;
        ticket_category_id: string;
        ticket_category_name: string;
        unit_price_ht: number;
        unit_price_ttc: number;
        total_price_ht: number;
        total_price_ttc: number;
        quantity: number;
        holder_first_name: string;
        holder_last_name: string;
        seat_info?: string;
      }[];
    };

    const platformConfig = await firstValueFrom(
      this.adminClient.send<{
        stripe_fee_percent: number;
        stripe_fee_fixed_eur: number;
        platform_legal_name: string;
        platform_siret: string;
        platform_vat_number: string;
        platform_address: string;
        ticket_pdf_wait_max_attempts: number;
        ticket_pdf_wait_delay_seconds: number;
      }>("admin.get_platform_config", {}),
    ).catch(() => ({
      stripe_fee_percent: 2.9,
      stripe_fee_fixed_eur: 0.3,
      platform_legal_name: "BilleTix SAS",
      platform_siret: "",
      platform_vat_number: "",
      platform_address: "",
      ticket_pdf_wait_max_attempts: 5,
      ticket_pdf_wait_delay_seconds: 2,
    }));

    // Commande gratuite : aucun frais de paiement.
    const feeGrid = { percent: platformConfig.stripe_fee_percent, fixed: platformConfig.stripe_fee_fixed_eur };
    const paymentFees =
      Number(order.total_amount_ttc) === 0
        ? 0
        : parseFloat(
            (
              Number(order.total_amount_ttc) * (feeGrid.percent / 100) +
              feeGrid.fixed
            ).toFixed(2),
          );

    // 2c. Marquer la commande comme payée (bug corrigé : jamais appelé auparavant —
    // le statut/paid_at de la commande ne changeait jamais après un vrai paiement)
    try {
      await firstValueFrom(
        this.orderClient.send("order.confirm_payment", {
          id: orderId,
          payment_intent_id: paymentIntentId,
          fees: paymentFees,
        }),
      );
    } catch (err) {
      // 409 : payé après l'annulation automatique, places reparties entre-temps.
      // Aucun billet ne sera émis : l'acheteur est remboursé intégralement.
      if ((err as { statusCode?: number })?.statusCode === 409 && Number(order.total_amount_ttc) > 0) {
        await this.refundRejectedPayment(order, paymentIntentId, err);
        return;
      }
      throw err;
    }

    // CDC §9 : notification « première vente » une seule fois, sans attente.
    if (order.organizer_id) {
      this.notifyIfFirstSale(order.organizer_id, order.event_id, order.event_name).catch(
        (err) => this.logger.error(`Erreur notification première vente event ${order.event_id}: ${err?.message}`),
      );
    }

    this.createOrganizerPayout(order, orderId, paymentFees);

    // Commande de revente : pas de nouveau billet, il est transféré par la finalisation de la revente.
    if (order.is_resale) {
      // La facture est la preuve d'achat (plus de billet PDF) : l'acheteur
      // en revente en reçoit une, comme pour un achat classique.
      this.emitInvoice(order, items, orderId, platformConfig);
      this.sendInvoiceEmail(order, items, orderId, platformConfig).catch((err) =>
        this.logger.error(`Erreur email facture commande ${orderId}: ${err?.message}`),
      );
      this.logger.log(
        `Post-paiement revente traité pour commande ${orderId} — billet déjà transféré via /resale/complete`,
      );
      return;
    }

    // 2d. Générer les billets dans ticket-service
    const tickets = (await firstValueFrom(
      this.ticketClient.send("ticket.generate", {
        order_id: orderId,
        buyer_id: order.buyer_id,
        buyer_email: order.buyer_email,
        buyer_first_name: order.buyer_first_name,
        buyer_last_name: order.buyer_last_name,
        event_id: order.event_id,
        event_name: order.event_name,
        event_start_at: order.event_start_at,
        event_end_at: order.event_end_at,
        event_venue_name: order.event_venue_name,
        event_venue_address: order.event_venue_address,
        event_city: order.event_city,
        event_poster_url: order.event_poster_url,
        artist_name: order.artist_name,
        artist_description: order.artist_description,
        // Mappe id → order_item_id attendu par ticket-service.
        items: items.map((item) => ({ ...item, order_item_id: item.id })),
      }),
    )) as Array<{
      id: string;
      reference: string;
      ticket_category_name: string;
      unit_price_ttc: number;
      seat_info?: string;
      holder_first_name: string;
      holder_last_name: string;
    }>;

    // Signal temps réel — le dashboard organisateur ouvert sur cet événement se rafraîchit
    this.realtime.dashboardChanged(order.event_id, "sale");

    // Sécurité : ni billet ni QR par email, seulement un accès à l'application puis la facture.
    this.notifClient.emit("notification.ticket_ready", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      eventName: order.event_name,
      eventDate: formatEventDate(order.event_start_at),
      eventVenue: order.event_venue_name,
      tickets: tickets.map((ticket) => ({
        ticketNumber: ticket.reference,
        categoryName: ticket.ticket_category_name,
        seatInfo: ticket.seat_info,
      })),
    });

    // Réservation gratuite : l'email d'accès aux billets suffit — pas de
    // facture à 0 € (aucune vente, et l'adresse n'a pas été demandée).
    if (Number(order.total_amount_ttc) > 0) {
      this.emitInvoice(order, items, orderId, platformConfig);
      this.sendInvoiceEmail(order, items, orderId, platformConfig).catch((err) =>
        this.logger.error(`Erreur email facture commande ${orderId}: ${err?.message}`),
      );
    }

    this.logger.log(
      `Post-achat traité : ${tickets.length} billet(s) générés pour commande ${orderId}`,
    );
  }

  /** Facture PDF : seule pièce jointe, le billet n'existe que dans l'application. */
  private emitInvoice(
    order: Record<string, any>,
    items: Array<Record<string, any>>,
    orderId: string,
    platformConfig: {
      platform_legal_name: string;
      platform_siret: string;
      platform_vat_number: string;
      platform_address: string;
    },
  ): void {
    this.pdfClient.emit("pdf.generate_invoice", {
      order_id: orderId,
      reference: order.reference,
      paid_at: new Date().toISOString(),
      // Taux de l'événement, recopié sur la commande à l'achat.
      tva_rate: Number(order.vat_rate ?? 0.2),
      billing_first_name: order.billing_first_name,
      billing_last_name: order.billing_last_name,
      billing_address_line1: order.billing_address_line1,
      billing_address_line2: order.billing_address_line2,
      billing_city: order.billing_city,
      billing_postal_code: order.billing_postal_code,
      billing_country: order.billing_country,
      // Decimals Postgres reçus en texte : conversion obligatoire pour pdf-service.
      items: items.map((item) => ({
        ticket_category_name: item.ticket_category_name,
        quantity: item.quantity,
        unit_price_ht: Number(item.unit_price_ht),
        unit_price_ttc: Number(item.unit_price_ttc),
        total_price_ht: Number(item.total_price_ht),
        total_price_ttc: Number(item.total_price_ttc),
      })),
      total_amount_ht: Number(order.total_amount_ht),
      total_amount_ttc: Number(order.total_amount_ttc),
      discount_amount: Number(order.discount_amount),
      free_ticket_fees: Number(order.free_ticket_fees),
      platform_legal_name: platformConfig.platform_legal_name,
      platform_siret: platformConfig.platform_siret,
      platform_vat_number: platformConfig.platform_vat_number,
      platform_address: platformConfig.platform_address,
    });
  }

  /** Facture d'achat par email, PDF joint s'il est prêt à temps (sinon disponible dans l'espace client). */
  private async sendInvoiceEmail(
    order: Record<string, any>,
    items: Array<Record<string, any>>,
    orderId: string,
    platformConfig: { ticket_pdf_wait_max_attempts: number; ticket_pdf_wait_delay_seconds: number },
  ): Promise<void> {
    const invoiceUrl = await this.waitForInvoice(
      orderId,
      platformConfig.ticket_pdf_wait_max_attempts,
      platformConfig.ticket_pdf_wait_delay_seconds * 1000,
    );
    // Bucket privé : la gateway lit la facture elle-même et la transmet à
    // notification-service (jamais de lien public vers le PDF).
    const invoicePdf = invoiceUrl
      ? await this.uploads.readStoredFile(invoiceUrl).catch((err) => {
          this.logger.warn(`Facture ${orderId} illisible pour l'email : ${err?.message}`);
          return null;
        })
      : null;
    const money = (value: unknown) => Number(value ?? 0).toFixed(2);
    const totalTtc = Number(order.total_amount_ttc);
    const billingAddress = [
      order.billing_address_line1,
      order.billing_address_line2,
      [order.billing_postal_code, order.billing_city].filter(Boolean).join(" "),
      order.billing_country,
    ]
      .filter(Boolean)
      .join(", ");

    this.notifClient.emit("notification.purchase_invoice", {
      email: order.buyer_email,
      firstName: order.buyer_first_name ?? order.billing_first_name ?? "",
      orderReference: order.reference,
      eventName: order.event_name,
      eventDate: formatEventDate(order.event_start_at),
      eventVenue: order.event_venue_name,
      items: items.map((item) => ({
        categoryName: item.ticket_category_name,
        quantity: String(item.quantity),
        unitPriceTtc: money(item.unit_price_ttc),
        totalPriceTtc: money(item.total_price_ttc),
      })),
      totalHt: money(order.total_amount_ht),
      totalVat: money(totalTtc - Number(order.total_amount_ht)),
      totalTtc: money(totalTtc),
      discount: Number(order.discount_amount) > 0 ? money(order.discount_amount) : undefined,
      // Frais des billets gratuits : à la charge de l'organisateur, absents du récapitulatif de l'acheteur.
      paymentMethod: totalTtc === 0 ? "Gratuit" : (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method),
      paidAt: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: DEFAULT_EVENT_TIMEZONE }),
      billingName: `${order.billing_first_name ?? ""} ${order.billing_last_name ?? ""}`.trim(),
      billingAddress,
      orderId,
      invoicePdfBase64: invoicePdf ? invoicePdf.toString("base64") : undefined,
    });
  }

  private async refundRejectedPayment(
    order: { id: string; reference: string; buyer_email: string; buyer_first_name: string; event_name: string; total_amount_ttc: number },
    paymentIntentId: string,
    reason: unknown,
  ): Promise<void> {
    this.logger.warn(
      `Paiement refusé à la confirmation, remboursement de la commande ${order.reference} : ${(reason as { message?: string })?.message}`,
    );
    await firstValueFrom(this.paymentClient.send("payment.refund", { order_id: order.id }));
    // Trace côté commande : l'acheteur et l'admin voient qu'elle a été remboursée.
    await firstValueFrom(
      this.orderClient.send("order.mark_late_payment_refunded", { id: order.id, payment_intent_id: paymentIntentId }),
    );
    this.notifClient.emit("notification.refund_completed", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      orderReference: order.reference,
      eventName: order.event_name,
      amount: Number(order.total_amount_ttc).toFixed(2),
    });
  }

  /** Reversement organisateur, ventes et reventes ; un net négatif est compensé plus tard. */
  private createOrganizerPayout(
    order: {
      organizer_id?: string;
      event_id: string;
      total_amount_ht: number;
      total_commission: number;
      free_ticket_fees?: number | string;
      event_end_at?: string;
    },
    orderId: string,
    paymentFees: number,
  ): void {
    if (!order.organizer_id) return;
    this.paymentClient
      .send("payment.create_payout", {
        organizer_id: order.organizer_id,
        event_id: order.event_id,
        order_id: orderId,
        gross_amount: Number(order.total_amount_ht),
        commission_amount: Number(order.total_commission),
        payment_fees_amount: paymentFees,
        free_ticket_fees_amount: Number(order.free_ticket_fees ?? 0),
        event_end_at: order.event_end_at,
      })
      .subscribe();
  }

  private async waitForInvoice(
    orderId: string,
    maxAttempts: number,
    delayMs: number,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await firstValueFrom(
        this.orderClient.send<{ order: { invoice_url: string | null } }>("order.get", { id: orderId }),
      ).catch(() => null);

      if (result?.order?.invoice_url) return result.order.invoice_url;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  /** Notifie l'organisateur seulement pour la toute première vente confirmée. */
  private async notifyIfFirstSale(
    organizerId: string,
    eventId: string,
    eventName: string,
  ): Promise<void> {
    const { is_first_sale } = await firstValueFrom(
      this.eventClient.send<{ is_first_sale: boolean }>("event.mark_first_sale", { id: eventId }),
    );
    if (!is_first_sale) return;

    const organizer = await firstValueFrom(
      this.authClient.send<{ email: string; first_name: string } | null>("auth.get_user", { id: organizerId }),
    ).catch(() => null);
    if (!organizer?.email) return;

    this.notifClient.emit("notification.first_sale", {
      email: organizer.email,
      firstName: organizer.first_name,
      eventName,
    });
  }
}
