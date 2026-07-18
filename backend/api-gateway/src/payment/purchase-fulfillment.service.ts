import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { TicketsGateway } from "../events/tickets.gateway";

/**
 * Orchestration post-achat (génération billets/PDF/facture, notifications,
 * reversement organisateur) — partagée entre le webhook Stripe (achat payant)
 * et la confirmation immédiate d'une commande entièrement gratuite (aucun
 * paiement Stripe impliqué, cf. tunnel gratuit du CDC §4.1).
 */
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
    private readonly ticketsGateway: TicketsGateway,
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
        tva_rate: number;
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
      tva_rate: 0.2,
      stripe_fee_percent: 2.9,
      stripe_fee_fixed_eur: 0.3,
      platform_legal_name: "BilletiX SAS",
      platform_siret: "",
      platform_vat_number: "",
      platform_address: "",
      ticket_pdf_wait_max_attempts: 5,
      ticket_pdf_wait_delay_seconds: 2,
    }));

    // Un événement entièrement gratuit (total_amount_ttc = 0) ne passe jamais
    // par Stripe (cf. tunnel gratuit CDC §4.1 : aucun moyen de paiement
    // sollicité) — donc aucun frais de paiement réel n'est jamais prélevé.
    const stripeFees =
      Number(order.total_amount_ttc) === 0
        ? 0
        : parseFloat(
            (
              Number(order.total_amount_ttc) *
                (platformConfig.stripe_fee_percent / 100) +
              platformConfig.stripe_fee_fixed_eur
            ).toFixed(2),
          );

    // 2c. Marquer la commande comme payée (bug corrigé : jamais appelé auparavant —
    // le statut/paid_at de la commande ne changeait jamais après un vrai paiement)
    await firstValueFrom(
      this.orderClient.send("order.confirm_payment", {
        id: orderId,
        payment_intent_id: paymentIntentId,
        fees: stripeFees,
      }),
    );

    // 2d. Générer les billets dans ticket-service
    const tickets = (await firstValueFrom(
      this.ticketClient.send("ticket.generate", {
        order_id: orderId,
        buyer_id: order.buyer_id,
        buyer_email: order.buyer_email,
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
        items,
      }),
    )) as Array<{
      id: string;
      reference: string;
      qr_code_url: string;
      ticket_category_name: string;
      unit_price_ttc: number;
      seat_info?: string;
      holder_first_name: string;
      holder_last_name: string;
    }>;

    // Signal temps réel — le dashboard organisateur ouvert sur cet événement se rafraîchit
    this.ticketsGateway.notifyDashboardUpdate(order.event_id, "sale");

    for (const ticket of tickets) {
      this.pdfClient.emit("pdf.generate_ticket", {
        ticket_id: ticket.id,
        reference: ticket.reference,
        order_id: orderId,
        event_name: order.event_name,
        event_start_at: order.event_start_at,
        event_venue_name: order.event_venue_name,
        event_venue_address: order.event_venue_address,
        event_city: order.event_city,
        event_poster_url: order.event_poster_url,
        artist_name: order.artist_name,
        ticket_category_name: ticket.ticket_category_name,
        unit_price_ttc: ticket.unit_price_ttc,
        seat_info: ticket.seat_info,
        holder_first_name: ticket.holder_first_name,
        holder_last_name: ticket.holder_last_name,
        buyer_email: order.buyer_email,
        qr_code_url: ticket.qr_code_url,
      });
    }

    this.notifClient.emit("notification.payment_confirmed", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      orderReference: order.reference,
      eventName: order.event_name,
      amount: Number(order.total_amount_ttc).toFixed(2),
      paymentDate: new Date().toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      paymentMethod: order.payment_method,
    });

    const ticketListWithPdf = await Promise.all(
      tickets.map(async (ticket) => ({
        ticketNumber: ticket.reference,
        categoryName: ticket.ticket_category_name,
        qrCodeUrl: ticket.qr_code_url,
        seatInfo: ticket.seat_info,
        pdfUrl: await this.waitForTicketPdf(
          ticket.id,
          platformConfig.ticket_pdf_wait_max_attempts,
          platformConfig.ticket_pdf_wait_delay_seconds * 1000,
        ),
      })),
    );

    this.notifClient.emit("notification.ticket_ready", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      eventName: order.event_name,
      eventDate: new Date(order.event_start_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      eventVenue: order.event_venue_name,
      tickets: ticketListWithPdf,
    });

    this.pdfClient.emit("pdf.generate_invoice", {
      order_id: orderId,
      reference: order.reference,
      paid_at: new Date().toISOString(),
      tva_rate: platformConfig.tva_rate,
      billing_first_name: order.billing_first_name,
      billing_last_name: order.billing_last_name,
      billing_email: order.billing_email,
      billing_address_line1: order.billing_address_line1,
      billing_address_line2: order.billing_address_line2,
      billing_city: order.billing_city,
      billing_postal_code: order.billing_postal_code,
      billing_country: order.billing_country,
      items: items.map((item) => ({
        ticket_category_name: item.ticket_category_name,
        quantity: item.quantity,
        unit_price_ht: item.unit_price_ht,
        unit_price_ttc: item.unit_price_ttc,
        total_price_ht: item.total_price_ht,
        total_price_ttc: item.total_price_ttc,
      })),
      total_amount_ht: order.total_amount_ht,
      total_amount_ttc: order.total_amount_ttc,
      discount_amount: order.discount_amount,
      free_ticket_fees: order.free_ticket_fees,
      platform_legal_name: platformConfig.platform_legal_name,
      platform_siret: platformConfig.platform_siret,
      platform_vat_number: platformConfig.platform_vat_number,
      platform_address: platformConfig.platform_address,
    });

    // Créer le reversement organisateur (stripeFees déjà calculés ci-dessus) —
    // pour un événement gratuit, gross/commission/fees valent tous 0 : le
    // reversement ne sert alors qu'à tracer le frais fixe billet gratuit
    // (déjà déduit de net_organizer_amount côté order-service).
    if (order.organizer_id) {
      this.paymentClient
        .send("payment.create_payout", {
          organizer_id: order.organizer_id,
          event_id: order.event_id,
          order_id: orderId,
          gross_amount: Number(order.total_amount_ht),
          commission_amount: Number(order.total_commission),
          payment_fees_amount: stripeFees,
          event_end_at: order.event_end_at,
        })
        .subscribe();
    }

    this.logger.log(
      `Post-achat traité : ${tickets.length} billet(s) générés pour commande ${orderId}`,
    );
  }

  private async waitForTicketPdf(
    ticketId: string,
    maxAttempts: number,
    delayMs: number,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ticket = await firstValueFrom(
        this.ticketClient.send("ticket.get", { id: ticketId }),
      ).catch(() => null);

      if (ticket?.pdf_url) return ticket.pdf_url;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }
}
