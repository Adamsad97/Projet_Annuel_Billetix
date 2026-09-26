import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { TicketsGateway } from "../events/tickets.gateway";
import { UploadService } from "../upload/upload.service";

/**
 * Orchestration post-achat (génération billets/PDF/facture, notifications,
 * reversement organisateur) — partagée entre le webhook Stripe (achat payant)
 * et la confirmation immédiate d'une commande entièrement gratuite (aucun
 * paiement Stripe impliqué, cf. tunnel gratuit du CDC §4.1).
 */

/** Libellés des moyens de paiement affichés sur la facture envoyée par email. */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE: "Carte bancaire",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  PAYPAL: "PayPal",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
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
    private readonly ticketsGateway: TicketsGateway,
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
        tva_rate: number;
        stripe_fee_percent: number;
        stripe_fee_fixed_eur: number;
        paypal_fee_percent: number;
        paypal_fee_fixed_eur: number;
        orange_money_fee_percent: number;
        orange_money_fee_fixed_eur: number;
        wave_fee_percent: number;
        wave_fee_fixed_eur: number;
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
      paypal_fee_percent: 3.4,
      paypal_fee_fixed_eur: 0.35,
      orange_money_fee_percent: 2.0,
      orange_money_fee_fixed_eur: 0,
      wave_fee_percent: 1.0,
      wave_fee_fixed_eur: 0,
      platform_legal_name: "BilletiX SAS",
      platform_siret: "",
      platform_vat_number: "",
      platform_address: "",
      ticket_pdf_wait_max_attempts: 5,
      ticket_pdf_wait_delay_seconds: 2,
    }));

    // Bug corrigé : une seule grille de frais (Stripe) était appliquée à tous
    // les prestataires — PayPal/Orange Money/Wave ont chacun leur propre
    // tarification, désormais configurable indépendamment via
    // platform_settings. Apple Pay/Google Pay transitent par Stripe (cf.
    // payment-service PaymentService.resolveProvider), donc même grille.
    const feeGridByPaymentMethod: Record<string, { percent: number; fixed: number }> = {
      STRIPE: { percent: platformConfig.stripe_fee_percent, fixed: platformConfig.stripe_fee_fixed_eur },
      APPLE_PAY: { percent: platformConfig.stripe_fee_percent, fixed: platformConfig.stripe_fee_fixed_eur },
      GOOGLE_PAY: { percent: platformConfig.stripe_fee_percent, fixed: platformConfig.stripe_fee_fixed_eur },
      PAYPAL: { percent: platformConfig.paypal_fee_percent, fixed: platformConfig.paypal_fee_fixed_eur },
      ORANGE_MONEY: { percent: platformConfig.orange_money_fee_percent, fixed: platformConfig.orange_money_fee_fixed_eur },
      WAVE: { percent: platformConfig.wave_fee_percent, fixed: platformConfig.wave_fee_fixed_eur },
    };

    // Un événement entièrement gratuit (total_amount_ttc = 0) ne passe jamais
    // par un prestataire de paiement (cf. tunnel gratuit CDC §4.1 : aucun
    // moyen de paiement sollicité) — donc aucun frais réel n'est jamais prélevé.
    const feeGrid =
      feeGridByPaymentMethod[order.payment_method] ??
      feeGridByPaymentMethod.STRIPE;
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
    await firstValueFrom(
      this.orderClient.send("order.confirm_payment", {
        id: orderId,
        payment_intent_id: paymentIntentId,
        fees: paymentFees,
      }),
    );

    // Bug corrigé (CDC §9 : notification "première vente" jamais envoyée) —
    // bascule atomique côté event-service (jamais notifié deux fois même en
    // cas d'appels concurrents), fire-and-forget.
    if (order.organizer_id) {
      this.notifyIfFirstSale(order.organizer_id, order.event_id, order.event_name).catch(
        (err) => this.logger.error(`Erreur notification première vente event ${order.event_id}: ${err?.message}`),
      );
    }

    this.createOrganizerPayout(order, orderId, paymentFees);

    // Bug corrigé : une commande de revente n'a pas de nouveau billet à
    // générer — le billet existant est transféré via POST
    // /tickets/resale/:id/complete, appelé par le frontend juste après la
    // confirmation Stripe (transfert + remboursement du vendeur + notification
    // déjà gérés là-bas). Ce webhook tentait quand même ticket.generate()
    // pour ces commandes, ce qui échouait systématiquement (erreur silencieuse,
    // seulement journalisée) et empêchait surtout la création du reversement
    // organisateur ci-dessus de s'exécuter (jamais atteinte à cause du throw).
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
        // ticket-service attend chaque item avec la clé `order_item_id`
        // (nom de la colonne NOT NULL côté Ticket) — `items` ici est la liste
        // brute des OrderItem (order-service), dont la clé primaire est `id`.
        // Bug corrigé : sans ce mapping, order_item_id était toujours
        // undefined et l'INSERT du ticket échouait systématiquement (23502).
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
    this.ticketsGateway.notifyDashboardUpdate(order.event_id, "sale");

    // Sécurité (demande produit) : ni billet ni QR code par email. Un email
    // d'accès (bouton vers l'application, connexion exigée à chaque clic) et,
    // plus bas, la facture détaillée une fois générée.
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
      tickets: tickets.map((ticket) => ({
        ticketNumber: ticket.reference,
        categoryName: ticket.ticket_category_name,
        seatInfo: ticket.seat_info,
      })),
    });

    this.emitInvoice(order, items, orderId, platformConfig);

    this.sendInvoiceEmail(order, items, orderId, platformConfig).catch((err) =>
      this.logger.error(`Erreur email facture commande ${orderId}: ${err?.message}`),
    );

    this.logger.log(
      `Post-achat traité : ${tickets.length} billet(s) générés pour commande ${orderId}`,
    );
  }

  /**
   * Facture PDF de la commande (pdf-service) — seule pièce jointe et seul
   * document téléchargeable : le billet n'existe que dans l'application.
   */
  private emitInvoice(
    order: Record<string, any>,
    items: Array<Record<string, any>>,
    orderId: string,
    platformConfig: {
      tva_rate: number;
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
      tva_rate: platformConfig.tva_rate,
      billing_first_name: order.billing_first_name,
      billing_last_name: order.billing_last_name,
      billing_email: order.billing_email,
      billing_address_line1: order.billing_address_line1,
      billing_address_line2: order.billing_address_line2,
      billing_city: order.billing_city,
      billing_postal_code: order.billing_postal_code,
      billing_country: order.billing_country,
      // Colonnes decimal Postgres renvoyées en string : sans ce cast,
      // pdf-service rejetait le message et invoice_url restait null
      // indéfiniment (facture jamais générée).
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

  /**
   * Facture d'achat par email : tout le détail de la commande, et le PDF
   * joint dès que pdf-service l'a généré (attente bornée par les réglages
   * d'attente des PDF de platform_settings ; sans PDF à temps, l'email part
   * quand même, la facture restant disponible dans l'espace client).
   * Remplace les anciens emails « commande confirmée » et « paiement
   * confirmé » (demande produit).
   */
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
      eventDate: new Date(order.event_start_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
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
      fees: Number(order.free_ticket_fees) > 0 ? money(order.free_ticket_fees) : undefined,
      paymentMethod: totalTtc === 0 ? "Gratuit" : (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method),
      paidAt: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      billingName: `${order.billing_first_name ?? ""} ${order.billing_last_name ?? ""}`.trim(),
      billingAddress,
      orderId,
      invoicePdfBase64: invoicePdf ? invoicePdf.toString("base64") : undefined,
    });
  }

  /** Reversement organisateur — commun aux commandes normales et de revente
   * (l'organisateur touche sa commission sur une revente comme sur une vente
   * initiale). Pour un événement gratuit, gross/commission/fees valent tous
   * 0 : le reversement ne sert alors qu'à tracer le frais fixe billet
   * gratuit (déjà déduit de net_organizer_amount côté order-service). */
  private createOrganizerPayout(
    order: { organizer_id?: string; event_id: string; total_amount_ht: number; total_commission: number; event_end_at?: string },
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

  /**
   * Notifie l'organisateur uniquement si cette commande est la toute
   * première vente réellement confirmée de l'événement (event.mark_first_sale
   * ne retourne is_first_sale=true qu'une seule fois, atomiquement).
   */
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
