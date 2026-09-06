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
import { PurchaseFulfillmentService } from "./purchase-fulfillment.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("payments")
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    private readonly ticketsGateway: TicketsGateway,
    private readonly fulfillment: PurchaseFulfillmentService,
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
        order_id: dto.order_id,
        buyer_id: user.sub,
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
    const result = (await firstValueFrom(
      this.paymentClient.send("payment.refund", {
        order_id: orderId,
        amount_cents: dto.amount_cents,
      }),
    )) as { status: string; refunded_amount: number };

    // Ne marquer la commande comme remboursée que si le remboursement
    // couvre le solde total — un remboursement partiel laisse les billets
    // valides, la commande reste CONFIRMED/TICKETS_SENT.
    if (result.status === "REFUNDED") {
      this.orderClient
        .send("order.mark_refunded", { id: orderId })
        .subscribe();
      // Bug corrigé : les billets de la commande n'étaient jamais invalidés
      // après un remboursement complet — un acheteur remboursé pouvait
      // encore se présenter à l'événement avec un billet valide et
      // scannable. order.mark_refunded restaure déjà le quota de son côté.
      this.ticketClient
        .send("ticket.cancel_by_order", { order_id: orderId })
        .subscribe();
    }

    // Notification acheteur (CDC §9.1 : « Remboursement effectué ») — ne
    // bloque jamais la réponse de l'endpoint en cas d'échec de notification.
    this.notifyRefundCompleted(orderId, result.status, result.refunded_amount).catch(
      (err) => this.logger.error(`Échec notification remboursement ${orderId}: ${err?.message}`),
    );

    this.checkRefundAlert().catch(() => undefined);
    return result;
  }

  private async notifyRefundCompleted(
    orderId: string,
    status: string,
    refundedAmount: number,
  ): Promise<void> {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id: orderId }),
    )) as {
      order: {
        buyer_email: string;
        buyer_first_name: string;
        reference: string;
        event_name: string;
      };
    };

    this.notifClient.emit("notification.refund_completed", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      orderReference: order.reference,
      eventName: order.event_name,
      amount: Number(refundedAmount).toFixed(2),
      refundType: status === "REFUNDED" ? "Remboursement total" : "Remboursement partiel",
    });
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

    // Notification organisateur (CDC §9.2 : « Litige ouvert ») — ne bloque
    // jamais la réponse de l'endpoint en cas d'échec de notification.
    this.notifyDisputeOpened(dto.order_id, dto.reason).catch((err) =>
      this.logger.error(`Échec notification litige ouvert (order ${dto.order_id}): ${err?.message}`),
    );

    this.checkDisputeAlert().catch(() => undefined);
    return result;
  }

  private async notifyDisputeOpened(orderId: string, reason: string): Promise<void> {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id: orderId }),
    )) as {
      order: { organizer_id?: string; event_name: string; reference: string };
    };
    if (!order.organizer_id) return;

    const organizer = (await firstValueFrom(
      this.authClient.send("auth.get_user", { id: order.organizer_id }),
    )) as { email: string; first_name: string } | null;
    if (!organizer?.email) return;

    this.notifClient.emit("notification.dispute_opened", {
      email: organizer.email,
      firstName: organizer.first_name,
      eventName: order.event_name,
      orderReference: order.reference,
      reason,
    });
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
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { status: string; resolution_notes?: string },
  ) {
    const dispute = (await firstValueFrom(
      this.paymentClient.send("payment.resolve_dispute", {
        id,
        ...dto,
        resolved_by: user.sub,
      }),
    )) as { order_id: string };

    // Bug corrigé (CDC §9.2) : le template dispute-opened promettait déjà
    // "vous serez notifié dès sa résolution", mais aucune notification
    // n'était jamais émise à la résolution — l'organisateur ne l'apprenait
    // qu'en constatant lui-même le déblocage de son reversement.
    this.notifyDisputeResolved(dispute.order_id, dto.status, dto.resolution_notes).catch((err) =>
      this.logger.error(`Échec notification litige résolu (order ${dispute.order_id}): ${err?.message}`),
    );

    return dispute;
  }

  private async notifyDisputeResolved(
    orderId: string,
    status: string,
    resolutionNotes?: string,
  ): Promise<void> {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id: orderId }),
    )) as {
      order: { organizer_id?: string; event_name: string; reference: string };
    };
    if (!order.organizer_id) return;

    const organizer = (await firstValueFrom(
      this.authClient.send("auth.get_user", { id: order.organizer_id }),
    )) as { email: string; first_name: string } | null;
    if (!organizer?.email) return;

    this.notifClient.emit("notification.dispute_resolved", {
      email: organizer.email,
      firstName: organizer.first_name,
      eventName: order.event_name,
      orderReference: order.reference,
      status,
      resolutionNotes: resolutionNotes ?? null,
    });
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
      failed?: boolean;
      failure_reason?: string;
    };

    if (!confirmed.order_id || confirmed.already_processed) {
      return { received: true };
    }

    if (confirmed.failed) {
      this.notifyPaymentFailed(
        confirmed.order_id,
        confirmed.failure_reason ?? "Paiement refusé",
      ).catch((err) =>
        this.logger.error(
          `Erreur notification échec paiement order ${confirmed.order_id}: ${err?.message}`,
        ),
      );
      return { received: true };
    }

    // 2. Post-confirmation asynchrone — ne bloque pas la réponse à Stripe
    this.fulfillment.confirmAndFulfill(
      confirmed.order_id,
      confirmed.payment_intent_id ?? "",
    ).catch((err) =>
      this.logger.error(
        `Erreur post-paiement order ${confirmed.order_id}: ${err?.message}`,
      ),
    );

    return { received: true };
  }

  private async notifyPaymentFailed(
    orderId: string,
    reason: string,
  ): Promise<void> {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id: orderId }),
    )) as {
      order: {
        buyer_email: string;
        buyer_first_name: string;
        reference: string;
        event_name: string;
        total_amount_ttc: number;
      };
    };

    this.notifClient.emit("notification.payment_failed", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      orderReference: order.reference,
      eventName: order.event_name,
      amount: Number(order.total_amount_ttc).toFixed(2),
      failureReason: reason,
    });
  }

  // ─── Webhook PayPal ─────────────────────────────────────────────────────────

  @Public()
  @Post("webhook/paypal")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Webhook PayPal (signature vérifiée côté payment-service)",
  })
  async paypalWebhook(@Req() req: RawBodyRequest<Request>) {
    const confirmed = (await firstValueFrom(
      this.paymentClient.send("payment.confirm_paypal_webhook", {
        payload: req.rawBody?.toString("utf8") ?? "",
        headers: req.headers as Record<string, string>,
      }),
    )) as {
      received: boolean;
      order_id?: string;
      payment_intent_id?: string;
      already_processed?: boolean;
      failed?: boolean;
    };

    if (!confirmed.order_id || confirmed.already_processed || confirmed.failed) {
      return { received: true };
    }

    this.fulfillment
      .confirmAndFulfill(confirmed.order_id, confirmed.payment_intent_id ?? "")
      .catch((err) =>
        this.logger.error(`Erreur post-paiement PayPal order ${confirmed.order_id}: ${err?.message}`),
      );

    return { received: true };
  }

  // ─── Callback Orange Money ──────────────────────────────────────────────────

  @Public()
  @Post("webhook/orange-money")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Callback de notification Orange Money (jeton vérifié côté payment-service)",
  })
  async orangeMoneyCallback(
    @Body() dto: { pay_token: string; order_id: string; notif_token: string },
  ) {
    const confirmed = (await firstValueFrom(
      this.paymentClient.send("payment.confirm_orange_money_callback", dto),
    )) as {
      received: boolean;
      order_id?: string;
      payment_intent_id?: string;
      already_processed?: boolean;
      failed?: boolean;
    };

    if (!confirmed.order_id || confirmed.already_processed || confirmed.failed) {
      return { received: true };
    }

    this.fulfillment
      .confirmAndFulfill(confirmed.order_id, confirmed.payment_intent_id ?? "")
      .catch((err) =>
        this.logger.error(`Erreur post-paiement Orange Money order ${confirmed.order_id}: ${err?.message}`),
      );

    return { received: true };
  }

  // ─── Webhook Wave ───────────────────────────────────────────────────────────

  @Public()
  @Post("webhook/wave")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Webhook Wave (signature vérifiée côté payment-service)",
  })
  async waveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("wave-signature") signatureHeader: string,
  ) {
    const confirmed = (await firstValueFrom(
      this.paymentClient.send("payment.confirm_wave_webhook", {
        payload: req.rawBody?.toString("utf8") ?? "",
        signatureHeader,
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

    this.fulfillment
      .confirmAndFulfill(confirmed.order_id, confirmed.payment_intent_id ?? "")
      .catch((err) =>
        this.logger.error(`Erreur post-paiement Wave order ${confirmed.order_id}: ${err?.message}`),
      );

    return { received: true };
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
