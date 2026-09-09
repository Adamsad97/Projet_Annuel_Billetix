import {
  BadRequestException,
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
import { CreateEventDto } from "../event/dto/create-event.dto";

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
      .then((organizerUser: { email: string; first_name: string }) => {
        this.notifClient.emit(pattern, {
          email: organizerUser.email,
          firstName: organizerUser.first_name,
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
      alerts,
    };
  }

  /**
   * CDC — dashboard admin : tri par ventes totales/billets vendus/chiffre
   * d'affaires sur une plage de dates au choix. Séparé de GET /admin/dashboard
   * (qui reste un instantané KPI figé) pour permettre au frontend de
   * recharger uniquement le graphique quand la plage change, sans
   * redemander tous les KPIs.
   */
  @Get("sales-trend")
  @ApiOperation({ summary: "Tendance ventes/billets/CA par jour sur une plage de dates" })
  getSalesTrend(@Query("from") from?: string, @Query("to") to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
    return firstValueFrom(
      this.orderClient.send("order.get_sales_trend", {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      }),
    );
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
    @Query("q") searchQuery?: string,
    @Query("role") role?: string,
    @Query("is_suspended") is_suspended?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return firstValueFrom(
      this.authClient.send("auth.list_users", {
        q: searchQuery,
        role,
        is_suspended:
          is_suspended === undefined ? undefined : is_suspended === "true",
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      }),
    );
  }

  /**
   * Bug corrigé (CDC §9) : aucune de ces 5 actions admin sur un compte
   * (suspension, levée, déverrouillage, reset 2FA, activation) ne notifiait
   * jamais le titulaire — il ne l'apprenait qu'en échouant à se connecter,
   * ou pas du tout pour un reset 2FA (risque de sécurité passé inaperçu si
   * ce n'était pas lui qui l'avait demandé). Les RPC auth.* renvoient déjà
   * l'utilisateur sanitizé (email/first_name inclus), pas de RPC supplémentaire.
   */
  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Suspendre un compte utilisateur" })
  async suspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.suspend_user", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    )) as { email: string; first_name: string };
    this.audit(user, req, "USER_SUSPENDED", "USER", id, dto.reason);
    this.notifClient.emit("notification.account_suspended", {
      email: result.email,
      firstName: result.first_name,
      reason: dto.reason,
    });
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
    const result = (await firstValueFrom(
      this.authClient.send("auth.unsuspend_user", { id, admin_id: user.sub }),
    )) as { email: string; first_name: string };
    this.audit(user, req, "USER_UNSUSPENDED", "USER", id);
    this.notifClient.emit("notification.account_unsuspended", {
      email: result.email,
      firstName: result.first_name,
    });
    return result;
  }

  @Post("users/:id/unlock")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Débloquer manuellement un compte verrouillé par échecs de connexion répétés (à la demande du titulaire)",
  })
  async unlockAccount(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.unlock_account", { id, admin_id: user.sub }),
    )) as { email: string; first_name: string };
    this.audit(user, req, "USER_ACCOUNT_UNLOCKED", "USER", id);
    this.notifClient.emit("notification.account_unlocked", {
      email: result.email,
      firstName: result.first_name,
    });
    return result;
  }

  @Post("users/:id/reset-2fa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Réinitialiser la 2FA d'un compte sans code (perte de l'appareil ET des codes de secours) — motif obligatoire",
  })
  async resetTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException("Un motif est requis pour réinitialiser la 2FA d'un compte.");
    }
    const result = (await firstValueFrom(
      this.authClient.send("auth.2fa.reset_by_admin", {
        user_id: id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    )) as { email: string; first_name: string };
    this.audit(user, req, "USER_2FA_RESET", "USER", id, dto.reason);
    this.notifClient.emit("notification.two_factor_reset_by_admin", {
      email: result.email,
      firstName: result.first_name,
      reason: dto.reason,
    });
    return result;
  }

  @Post("users/:id/activate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Activer manuellement un compte dont l'email n'a jamais été vérifié (à la demande du titulaire)",
  })
  async activateAccount(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.activate_account", { id, admin_id: user.sub }),
    )) as { email: string; first_name: string };
    this.audit(user, req, "USER_ACCOUNT_ACTIVATED", "USER", id);
    this.notifClient.emit("notification.account_activated", {
      email: result.email,
      firstName: result.first_name,
    });
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

  /**
   * CDC — accueil physique : un organisateur venu directement au bureau peut
   * demander à un admin de créer son événement pour lui plutôt que de
   * passer par le formulaire en ligne. Le compte organisateur doit déjà
   * exister (recherché via GET /admin/users) ; l'événement est créé DRAFT
   * sous son compte, exactement comme s'il l'avait fait lui-même — l'admin
   * enchaîne ensuite avec les catégories de billets, la soumission puis sa
   * propre validation (POST .../submit puis .../approve, déjà existants).
   */
  @Post("events")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Créer un événement au nom d'un organisateur (accueil physique)" })
  async createEventForOrganizer(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() body: { organizer_id: string; dto: CreateEventDto },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.create", { organizer_id: body.organizer_id, dto: body.dto }),
    );
    this.audit(user, req, "CUSTOM", "EVENT", (result as { id: string }).id, `Événement créé par l'admin pour l'organisateur ${body.organizer_id} (accueil physique)`);
    return result;
  }

  @Post("events/:id/categories")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Ajouter une catégorie de billet à un événement créé pour un organisateur (accueil physique)" })
  createCategoryForOrganizer(
    @Param("id") id: string,
    @Body() body: { organizer_id: string; dto: Record<string, unknown> },
  ) {
    return firstValueFrom(
      this.eventClient.send("event.create_category", {
        dto: { ...body.dto, event_id: id },
        organizer_id: body.organizer_id,
      }),
    );
  }

  @Post("events/:id/submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soumettre à la validation un événement créé pour un organisateur (accueil physique)" })
  submitEventForOrganizer(@Param("id") id: string, @Body() body: { organizer_id: string }) {
    return firstValueFrom(
      this.eventClient.send("event.submit_for_validation", { id, organizer_id: body.organizer_id }),
    );
  }

  @Get("events/pending")
  @ApiOperation({ summary: "Événements en attente de modération" })
  async getPendingEvents() {
    const events = (await firstValueFrom(
      this.eventClient.send("event.list_pending", {}),
    )) as Array<{ organizer_id: string; [key: string]: unknown }>;

    // Enrichi ici (nom/email organisateur) plutôt qu'un aller-retour par
    // ligne côté frontend — même pattern que myPayouts (payment.controller.ts).
    const organizerIds = [...new Set(events.map((event) => event.organizer_id))];
    const organizers = (await firstValueFrom(
      this.authClient.send("auth.get_users_by_ids", { ids: organizerIds }),
    ).catch(() => [])) as Array<{ id: string; first_name: string; last_name: string; email: string }>;
    const organizerById = new Map(organizers.map((organizer) => [organizer.id, organizer]));

    return events.map((event) => {
      const organizer = organizerById.get(event.organizer_id);
      return {
        ...event,
        organizer_name: organizer ? `${organizer.first_name} ${organizer.last_name}` : null,
        organizer_email: organizer?.email ?? null,
      };
    });
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

  /**
   * Bug corrigé (CDC §3.2) : la commission 0% "à but non lucratif" était
   * accordée automatiquement dès que l'organisateur cochait is_non_profit
   * (auto-déclaratif), sans qu'aucun admin ne vérifie le justificatif.
   * Étape désormais distincte de l'approbation générale de l'événement — à
   * faire avant POST /events/:id/approve pour que l'exonération s'applique.
   */
  @Post("events/:id/verify-non-profit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vérifier le justificatif \"à but non lucratif\" d'un événement" })
  async verifyEventNonProfit(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { approved: boolean },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.verify_non_profit", {
        id,
        admin_id: user.sub,
        approved: dto.approved,
      }),
    );
    this.audit(
      user,
      req,
      dto.approved ? "EVENT_NON_PROFIT_VERIFIED" : "EVENT_NON_PROFIT_REJECTED",
      "EVENT",
      id,
    );
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

  @Post("events/:id/request-info")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Demander un complément d'information à l'organisateur (suspend le délai de traitement)" })
  async requestEventInfo(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: { message: string },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.request_info", {
        id,
        admin_id: user.sub,
        message: dto.message,
      }),
    );
    this.audit(user, req, "CUSTOM", "EVENT", id, `Complément d'information demandé : ${dto.message}`);
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

  @Post("payouts/:id/unblock")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Débloquer manuellement un reversement bloqué" })
  async unblockPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.unblock_payout", { id }),
    );
    this.audit(user, req, "PAYOUT_UNBLOCKED", "PAYOUT", id);
    return result;
  }

  /**
   * Déclenchement manuel du virement d'un reversement en attente, sans
   * attendre le prochain passage du cron quotidien (10h00) — mêmes
   * vérifications d'éligibilité (Stripe Connect onboardé + KYC validé) que
   * PayoutSchedulerService.processDuePayouts, dupliquées ici car ce chemin
   * est déclenché depuis l'admin plutôt que depuis le scheduler.
   */
  @Post("payouts/:id/process")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Déclencher manuellement le virement d'un reversement" })
  async processPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const payout = await firstValueFrom(
      this.paymentClient.send("payment.get_payout", { id }),
    );

    const profile = await firstValueFrom(
      this.userClient.send("user.get_organizer_profile", {
        user_id: payout.organizer_id,
      }),
    );
    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_onboarded) {
      throw new BadRequestException(
        "Compte Stripe Connect non configuré pour cet organisateur",
      );
    }
    if (profile.kyc_status !== "VERIFIED") {
      throw new BadRequestException("KYC non validé pour cet organisateur");
    }

    const result = await firstValueFrom(
      this.paymentClient.send("payment.process_payout", {
        id,
        stripe_account_id: profile.stripe_connect_account_id,
      }),
    );
    this.audit(user, req, "PAYOUT_PROCESSED_MANUALLY", "PAYOUT", id);
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

  // ─── Newsletter ───────────────────────────────────────────────────────────────

  @Get("newsletter/recipients-count")
  @ApiOperation({ summary: "Nombre d'acheteurs abonnés à la newsletter" })
  async getNewsletterRecipientsCount() {
    const userIds = (await firstValueFrom(
      this.userClient.send("user.list_newsletter_subscribers", {}),
    )) as string[];
    return { count: userIds.length };
  }

  @Post("newsletter/send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Envoyer une newsletter à tous les abonnés" })
  async sendNewsletter(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: { subject: string; body: string },
  ) {
    if (!dto.subject?.trim() || !dto.body?.trim()) {
      throw new BadRequestException("Le sujet et le contenu sont obligatoires.");
    }

    const userIds = (await firstValueFrom(
      this.userClient.send("user.list_newsletter_subscribers", {}),
    )) as string[];

    if (userIds.length === 0) {
      return { sent: 0 };
    }

    const recipients = (await firstValueFrom(
      this.authClient.send("auth.get_users_by_ids", { ids: userIds }),
    )) as Array<{ email: string; first_name: string }>;

    for (const recipient of recipients) {
      this.notifClient.emit("notification.newsletter", {
        email: recipient.email,
        firstName: recipient.first_name,
        subject: dto.subject,
        body: dto.body,
      });
    }

    this.audit(user, req, "CUSTOM", "USER", undefined, `Newsletter envoyée : ${dto.subject}`, {
      recipients_count: recipients.length,
    });

    return { sent: recipients.length };
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
