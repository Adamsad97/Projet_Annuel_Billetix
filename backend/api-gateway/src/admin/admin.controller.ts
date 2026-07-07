import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";

@ApiTags("admin")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
  ) {}

  private ip(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? ""
    );
  }

  private notifyOrganizer(
    organizerId: string,
    pattern: string,
    extra: Record<string, unknown>,
  ): void {
    firstValueFrom(this.authClient.send("auth.get_user", { id: organizerId }))
      .then((u: { email: string; first_name: string }) => {
        this.notifClient.emit(pattern, {
          email: u.email,
          firstName: u.first_name,
          ...extra,
        });
      })
      .catch(() => {
        /* log silencieux — la notif est best-effort */
      });
  }

  private audit(
    user: JwtPayload,
    req: Request,
    action: string,
    entity_type: string,
    entity_id?: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): void {
    // Fire-and-forget via TCP — l'audit ne bloque jamais une action admin
    this.adminClient
      .send("admin.log_action", {
        action,
        entity_type,
        entity_id: entity_id ?? null,
        performed_by: user.sub,
        performed_by_email: user.email,
        reason: reason ?? null,
        metadata: metadata ?? null,
        ip_address: this.ip(req),
      })
      .subscribe();
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  @Get("stats")
  @ApiOperation({ summary: "Statistiques de l'audit log" })
  getStats() {
    return firstValueFrom(this.adminClient.send("admin.get_stats", {}));
  }

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Tableau de bord KPIs plateforme (ventes, litiges, reversements, tendance, alertes)",
  })
  async getDashboard() {
    const [
      revenue,
      openDisputes,
      platformBalance,
      eventsByStatus,
      userStats,
      trend,
      recentRefundCount,
      platformConfig,
    ] = await Promise.all([
      firstValueFrom(
        this.orderClient.send("order.get_platform_revenue", {}),
      ).catch(() => ({ orders_count: 0, revenue_ht: 0, revenue_ttc: 0, total_commission: 0 })),
      firstValueFrom(
        this.paymentClient.send("payment.get_open_dispute_count", {}),
      ).catch(() => 0),
      firstValueFrom(
        this.paymentClient.send("payment.get_platform_balance", {}),
      ).catch(() => ({ pending_balance: 0, total_paid_out: 0 })),
      firstValueFrom(
        this.eventClient.send("event.get_count_by_status", {}),
      ).catch(() => ({})),
      firstValueFrom(this.authClient.send("auth.get_user_stats", {})).catch(
        () => ({ by_role: {}, suspended_count: 0, total: 0 }),
      ),
      firstValueFrom(
        this.orderClient.send("order.get_revenue_trend", { days: 30 }),
      ).catch(() => []),
      firstValueFrom(
        this.orderClient.send("order.get_recent_refund_count", { hours: 24 }),
      ).catch(() => 0),
      firstValueFrom(
        this.adminClient.send("admin.get_platform_config", {}),
      ).catch(() => ({
        dispute_alert_threshold: 5,
        refund_alert_threshold_24h: 10,
      })),
    ]);

    const alerts: Array<{
      type: string;
      severity: "warning" | "critical";
      message: string;
    }> = [];

    const disputeThreshold = (
      platformConfig as { dispute_alert_threshold: number }
    ).dispute_alert_threshold;
    if ((openDisputes as number) >= disputeThreshold) {
      alerts.push({
        type: "dispute_spike",
        severity: "warning",
        message: `${openDisputes} litige(s) ouvert(s) — seuil d'alerte : ${disputeThreshold}`,
      });
    }

    const refundThreshold = (
      platformConfig as { refund_alert_threshold_24h: number }
    ).refund_alert_threshold_24h;
    if ((recentRefundCount as number) >= refundThreshold) {
      alerts.push({
        type: "mass_refunds",
        severity: "critical",
        message: `${recentRefundCount} remboursement(s) sur les dernières 24h — seuil d'alerte : ${refundThreshold}`,
      });
    }

    return {
      kpis: {
        ...(revenue as Record<string, unknown>),
        open_disputes: openDisputes,
        pending_payout_balance: (platformBalance as { pending_balance: number })
          .pending_balance,
        total_paid_out: (platformBalance as { total_paid_out: number })
          .total_paid_out,
        events_by_status: eventsByStatus,
        users: userStats,
      },
      trend,
      alerts,
    };
  }

  // ─── Audit logs ───────────────────────────────────────────────────────────────

  @Get("audit-logs")
  @ApiOperation({ summary: "Journal des actions admin" })
  getLogs(
    @Query("entity_type") entity_type?: string,
    @Query("entity_id") entity_id?: string,
    @Query("performed_by") performed_by?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return firstValueFrom(
      this.adminClient.send("admin.get_logs", {
        entity_type,
        entity_id,
        performed_by,
        action,
        from,
        to,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      }),
    );
  }

  // ─── Gestion des utilisateurs ─────────────────────────────────────────────────

  @Get("users")
  @ApiOperation({
    summary:
      "Recherche/liste globale des utilisateurs (email, nom, rôle, statut)",
  })
  searchUsers(
    @Query("q") q?: string,
    @Query("role") role?: string,
    @Query("is_suspended") is_suspended?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return firstValueFrom(
      this.authClient.send("auth.list_users", {
        q,
        role,
        is_suspended:
          is_suspended === undefined ? undefined : is_suspended === "true",
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      }),
    );
  }

  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Suspendre un compte utilisateur" })
  async suspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.authClient.send("auth.suspend_user", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
    this.audit(user, req, "USER_SUSPENDED", "USER", id, dto.reason);
    return result;
  }

  @Post("users/:id/unsuspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Lever la suspension d'un compte" })
  async unsuspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = await firstValueFrom(
      this.authClient.send("auth.unsuspend_user", { id, admin_id: user.sub }),
    );
    this.audit(user, req, "USER_UNSUSPENDED", "USER", id);
    return result;
  }

  @Post("users/:id/change-role")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Changer le rôle d'un utilisateur" })
  async changeRole(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { role: string },
  ) {
    const result = await firstValueFrom(
      this.authClient.send("auth.change_role", {
        id,
        role: dto.role,
        admin_id: user.sub,
      }),
    );
    this.audit(user, req, "USER_ROLE_CHANGED", "USER", id, undefined, {
      new_role: dto.role,
    });
    return result;
  }

  // ─── Modération des événements ────────────────────────────────────────────────

  @Get("events/pending")
  @ApiOperation({ summary: "Événements en attente de modération" })
  getPendingEvents() {
    return firstValueFrom(this.eventClient.send("event.list_pending", {}));
  }

  @Post("events/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approuver un événement" })
  async approveEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.validate", { id, admin_id: user.sub }),
    );
    this.audit(user, req, "EVENT_APPROVED", "EVENT", id);
    // Notification organisateur envoyée par event-service (validate()) — pas de doublon ici.
    return result;
  }

  @Post("events/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rejeter un événement" })
  async rejectEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.reject", {
        id,
        admin_id: user.sub,
        dto: { reason: dto.reason },
      }),
    );
    this.audit(user, req, "EVENT_REJECTED", "EVENT", id, dto.reason);
    // Notification organisateur envoyée par event-service (reject()) — pas de doublon ici.
    return result;
  }

  @Post("events/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Annuler un événement (ADMIN) — le remboursement des acheteurs se déclenche via POST /events/:id/cancel",
  })
  async cancelEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.cancel", {
        id,
        actor_id: user.sub,
        dto: { reason: dto.reason },
        is_admin: true,
      }),
    );
    this.audit(user, req, "EVENT_CANCELED", "EVENT", id, dto.reason);
    return result;
  }

  // ─── Gestion des billets ──────────────────────────────────────────────────────

  @Post("tickets/:id/invalidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Invalider un billet" })
  async invalidateTicket(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.ticketClient.send("ticket.invalidate", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
    this.audit(user, req, "TICKET_INVALIDATED", "TICKET", id, dto.reason);
    return result;
  }

  // ─── Gestion des reversements ─────────────────────────────────────────────────

  @Post("payouts/:id/block")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bloquer un reversement" })
  async blockPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.block_payout", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
    this.audit(user, req, "PAYOUT_BLOCKED", "PAYOUT", id, dto.reason);
    return result;
  }

  @Post("payouts/:id/approve-early")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approuver un reversement anticipé" })
  async approveEarlyPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.approve_early_payout", {
        id,
        admin_id: user.sub,
      }),
    );
    this.audit(user, req, "PAYOUT_EARLY_APPROVED", "PAYOUT", id);
    return result;
  }

  // ─── Gestion des litiges ──────────────────────────────────────────────────────

  @Get("disputes")
  @ApiOperation({ summary: "Tous les litiges" })
  getAllDisputes(@Query("order_id") order_id?: string) {
    if (order_id) {
      return firstValueFrom(
        this.paymentClient.send("payment.get_disputes_by_order", { order_id }),
      );
    }
    return firstValueFrom(
      this.paymentClient.send("payment.get_all_disputes", {}),
    );
  }

  @Post("disputes/:id/resolve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Résoudre un litige" })
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { status: string; resolution_notes?: string },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.resolve_dispute", {
        id,
        ...dto,
        resolved_by: user.sub,
      }),
    );
    this.audit(user, req, "DISPUTE_RESOLVED", "DISPUTE", id, undefined, {
      status: dto.status,
    });
    return result;
  }

  // ─── KYC organisateurs ───────────────────────────────────────────────────────

  @Get("kyc/pending")
  @ApiOperation({
    summary: "Profils organisateurs en attente de vérification KYC",
  })
  getPendingKyc() {
    return firstValueFrom(this.userClient.send("user.list_kyc_pending", {}));
  }

  @Post("kyc/:userId/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approuver le KYC d'un organisateur" })
  async approveKyc(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("userId") userId: string,
  ) {
    const result = await firstValueFrom(
      this.userClient.send("user.update_kyc", {
        user_id: userId,
        dto: { kyc_status: "VERIFIED" },
      }),
    );
    this.audit(user, req, "KYC_APPROVED", "USER", userId);
    this.notifyOrganizer(userId, "notification.kyc_approved", {});
    return result;
  }

  @Post("kyc/:userId/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rejeter le KYC d'un organisateur" })
  async rejectKyc(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("userId") userId: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.userClient.send("user.update_kyc", {
        user_id: userId,
        dto: { kyc_status: "REJECTED", kyc_rejected_reason: dto.reason },
      }),
    );
    this.audit(user, req, "KYC_REJECTED", "USER", userId, dto.reason);
    this.notifyOrganizer(userId, "notification.kyc_rejected", {
      reason: dto.reason,
    });
    return result;
  }

  // ─── Configuration plateforme ────────────────────────────────────────────────

  @Get("config")
  @ApiOperation({
    summary: "Liste tous les paramètres configurables de la plateforme",
  })
  getPlatformConfig() {
    return firstValueFrom(
      this.adminClient.send("admin.list_platform_settings", {}),
    );
  }

  @Patch("config/:key")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Modifier un paramètre de la plateforme" })
  async updatePlatformConfig(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("key") key: string,
    @Body() dto: { value: string },
  ) {
    const result = await firstValueFrom(
      this.adminClient.send("admin.update_platform_setting", {
        key,
        value: dto.value,
      }),
    );
    this.audit(
      user,
      req,
      "CUSTOM",
      "PAYMENT",
      undefined,
      `Config ${key} → ${dto.value}`,
      { key, value: dto.value },
    );
    return result;
  }

  // ─── Remboursement forcé ──────────────────────────────────────────────────────

  @Post("orders/:orderId/force-refund")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Forcer un remboursement (ADMIN)" })
  async forceRefund(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("orderId") orderId: string,
    @Body() dto: { reason: string; amount_cents?: number },
  ) {
    const result = (await firstValueFrom(
      this.paymentClient.send("payment.refund", {
        order_id: orderId,
        amount_cents: dto.amount_cents,
      }),
    )) as { status: string };

    if (result.status === "REFUNDED") {
      this.orderClient
        .send("order.mark_refunded", { id: orderId })
        .subscribe();
    }

    this.audit(user, req, "REFUND_FORCED", "ORDER", orderId, dto.reason, {
      amount_cents: dto.amount_cents,
    });
    return result;
  }
}
