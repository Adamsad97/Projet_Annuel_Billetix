import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { firstValueFrom } from "rxjs";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { TicketsGateway } from "../events/tickets.gateway";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("payments")
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("PDF_SERVICE") private readonly pdfClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  @Post("intent")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Créer un PaymentIntent Stripe" })
  createIntent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return firstValueFrom(
      this.paymentClient.send("payment.create_intent", {
        ...dto,
        buyer_email: user.email,
      }),
    );
  }

  @Get("order/:orderId")
  @ApiOperation({ summary: "Paiement d'une commande" })
  getByOrder(@Param("orderId") orderId: string) {
    return firstValueFrom(
      this.paymentClient.send("payment.get_by_order", { order_id: orderId }),
    );
  }

  @Post("refund/:orderId")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Rembourser une commande (ADMIN)" })
  async refund(
    @Param("orderId") orderId: string,
    @Body() dto: { amount_cents?: number },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.refund", {
        order_id: orderId,
        amount_cents: dto.amount_cents,
      }),
    );
    this.checkRefundAlert().catch(() => undefined);
    return result;
  }

  // ─── Reversements ───────────────────────────────────────────────────────────

  @Get("balance/me")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Solde virtuel de l'organisateur (ORGANIZER)" })
  myBalance(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.paymentClient.send("payment.get_organizer_balance", {
        organizer_id: user.sub,
      }),
    );
  }

  @Get("payouts/me")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Mes reversements (ORGANIZER)" })
  myPayouts(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.paymentClient.send("payment.get_payouts_by_organizer", {
        organizer_id: user.sub,
      }),
    );
  }

  @Post("payouts/:id/request-early")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Demander un reversement anticipé (ORGANIZER)" })
  requestEarlyPayout(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return firstValueFrom(
      this.paymentClient.send("payment.request_early_payout", {
        id,
        organizer_id: user.sub,
      }),
    );
  }

  @Post("payouts/:id/approve-early")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Approuver un reversement anticipé (ADMIN)" })
  approveEarlyPayout(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return firstValueFrom(
      this.paymentClient.send("payment.approve_early_payout", {
        id,
        admin_id: user.sub,
      }),
    );
  }

  @Post("payouts/:id/block")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Bloquer un reversement (ADMIN)" })
  blockPayout(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    return firstValueFrom(
      this.paymentClient.send("payment.block_payout", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
  }

  // ─── Litiges ────────────────────────────────────────────────────────────────

  @Post("disputes")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Ouvrir un litige" })
  async createDispute(
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: {
      payment_id: string;
      order_id: string;
      reason: string;
      description?: string;
    },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.create_dispute", {
        ...dto,
        buyer_id: user.sub,
      }),
    );
    this.checkDisputeAlert().catch(() => undefined);
    return result;
  }

  @Get("disputes/me")
  @ApiOperation({ summary: "Mes litiges" })
  myDisputes(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.paymentClient.send("payment.get_disputes_by_buyer", {
        buyer_id: user.sub,
      }),
    );
  }

  @Get("disputes/order/:orderId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Litiges d'une commande (ADMIN)" })
  disputesByOrder(@Param("orderId") orderId: string) {
    return firstValueFrom(
      this.paymentClient.send("payment.get_disputes_by_order", {
        order_id: orderId,
      }),
    );
  }

  @Post("disputes/:id/resolve")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Résoudre un litige (ADMIN)" })
  resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { status: string; resolution_notes?: string },
  ) {
    return firstValueFrom(
      this.paymentClient.send("payment.resolve_dispute", {
        id,
        ...dto,
        resolved_by: user.sub,
      }),
    );
  }

  // ─── Webhook Stripe ─────────────────────────────────────────────────────────

  @Public()
  @Post("webhook/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Webhook Stripe (signature vérifiée côté payment-service)",
  })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    // 1. Vérifier signature + confirmer paiement dans payment-service
    const confirmed = (await firstValueFrom(
      this.paymentClient.send("payment.confirm_webhook", {
        payload: req.rawBody?.toString("utf8") ?? "",
        signature,
      }),
    )) as {
      received: boolean;
      order_id?: string;
      payment_intent_id?: string;
      already_processed?: boolean;
    };

    if (!confirmed.order_id || confirmed.already_processed) {
      return { received: true };
    }

    // 2. Post-confirmation asynchrone — ne bloque pas la réponse à Stripe
    this.postPaymentConfirmed(
      confirmed.order_id,
      confirmed.payment_intent_id ?? "",
    ).catch((err) =>
      this.logger.error(
        `Erreur post-paiement order ${confirmed.order_id}: ${err?.message}`,
      ),
    );

    return { received: true };
  }

  // ─── Orchestration post-paiement ────────────────────────────────────────────

  private async postPaymentConfirmed(
    orderId: string,
    paymentIntentId: string,
  ): Promise<void> {
    // 2a. Récupérer la commande (buyer + items + event info)
    // order.get renvoie { order, items } — bien conserver la forme imbriquée
    // (bug corrigé : ce code lisait auparavant les champs à plat, ce qui
    // rendait buyer_id/event_name/items etc. tous `undefined` en pratique).
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

    // 2b. Récupérer la config plateforme une seule fois (frais Stripe, TVA, infos légales facture)
    const platformConfig = await firstValueFrom(
      this.adminClient.send<{
        tva_rate: number;
        stripe_fee_percent: number;
        stripe_fee_fixed_eur: number;
        platform_legal_name: string;
        platform_siret: string;
        platform_vat_number: string;
        platform_address: string;
      }>("admin.get_platform_config", {}),
    ).catch(() => ({
      tva_rate: 0.2,
      stripe_fee_percent: 2.9,
      stripe_fee_fixed_eur: 0.3,
      platform_legal_name: "BilletiX SAS",
      platform_siret: "",
      platform_vat_number: "",
      platform_address: "",
    }));

    const stripeFees = parseFloat(
      (
        Number(order.total_amount_ttc) * (platformConfig.stripe_fee_percent / 100) +
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

    // 2c. Pour chaque billet : déclencher génération PDF + notification (fire-and-forget)
    const ticketList = tickets.map((ticket) => ({
      ticket_id: ticket.id,
      qr_code_url: ticket.qr_code_url,
      ticket_category_name: ticket.ticket_category_name,
    }));

    // Signal temps réel — le dashboard organisateur ouvert sur cet événement se rafraîchit
    this.ticketsGateway.notifyDashboardUpdate(order.event_id, "sale");

    for (const ticket of tickets) {
      // PDF
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

    // Notification : commande + billets confirmés (un seul email groupé)
    this.notifClient.emit("notification.payment_confirmed", {
      email: order.buyer_email,
      first_name: order.buyer_first_name,
      last_name: order.buyer_last_name,
      order_id: orderId,
      event_name: order.event_name,
      event_date: order.event_start_at,
      event_venue: order.event_venue_name,
      tickets: ticketList,
      total_amount_ttc: order.total_amount_ttc,
    });

    this.notifClient.emit("notification.ticket_ready", {
      email: order.buyer_email,
      first_name: order.buyer_first_name,
      last_name: order.buyer_last_name,
      event_name: order.event_name,
      event_date: order.event_start_at,
      event_venue: order.event_venue_name,
      tickets: ticketList,
    });

    // 2e. Générer la facture PDF (fire-and-forget, comme pour les billets)
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

    // Créer le reversement organisateur (stripeFees déjà calculés ci-dessus)
    if (order.organizer_id) {
      this.paymentClient
        .send("payment.create_payout", {
          organizer_id: order.organizer_id,
          event_id: order.event_id,
          gross_amount: Number(order.total_amount_ht),
          commission_amount: Number(order.total_commission),
          payment_fees_amount: stripeFees,
          event_end_at: order.event_end_at,
        })
        .subscribe();
    }

    this.logger.log(
      `Post-paiement traité : ${tickets.length} billet(s) générés pour commande ${orderId}`,
    );
  }

  // ─── Alertes admin temps réel ───────────────────────────────────────────────

  private async checkRefundAlert(): Promise<void> {
    const [count, config] = await Promise.all([
      firstValueFrom(
        this.orderClient.send("order.get_recent_refund_count", { hours: 24 }),
      ),
      firstValueFrom(
        this.adminClient.send<{ refund_alert_threshold_24h: number }>(
          "admin.get_platform_config",
          {},
        ),
      ),
    ]);

    if ((count as number) >= config.refund_alert_threshold_24h) {
      this.ticketsGateway.notifyAdminAlert({
        type: "mass_refunds",
        severity: "critical",
        message: `${count} remboursement(s) sur les dernières 24h — seuil d'alerte : ${config.refund_alert_threshold_24h}`,
      });
    }
  }

  private async checkDisputeAlert(): Promise<void> {
    const [count, config] = await Promise.all([
      firstValueFrom(this.paymentClient.send("payment.get_open_dispute_count", {})),
      firstValueFrom(
        this.adminClient.send<{ dispute_alert_threshold: number }>(
          "admin.get_platform_config",
          {},
        ),
      ),
    ]);

    if ((count as number) >= config.dispute_alert_threshold) {
      this.ticketsGateway.notifyAdminAlert({
        type: "dispute_spike",
        severity: "warning",
        message: `${count} litige(s) ouvert(s) — seuil d'alerte : ${config.dispute_alert_threshold}`,
      });
    }
  }
}
