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
import { CancelledEventSnapshot, EventRefundService } from "../event/event-refund.service";
import { EventPostponementService, type PostponedEvent } from "../event/event-postponement.service";
import { formatEventDate } from "../common/event-date";
import { redactIpUnlessSuperAdmin } from "../common/redact-ip";
import { RejectTransferRevertDto, RevertTransferDto } from "../ticket/dto/transfer-revert.dto";
import { MessageDto, OptionalMessageDto, ReasonDto } from "../common/dto/common.dto";
import {
  AdminEventsQueryDto,
  AuditLogsQueryDto,
  AdminPayoutsQueryDto,
  AdminUsersQueryDto,
  CancellationRequestsQueryDto,
  ChangeRoleDto, CreateCategoryForOrganizerDto, CreateEventForOrganizerDto, ForceRefundDto, OrganizerRefDto, ResolveDisputeDto, SendNewsletterDto, UpdateSettingDto, VerifyNonProfitDto } from "./dto/admin-actions.dto";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { SetEventVatRateDto } from "../event/dto/vat-rate.dto";
import { CreditNoteIssuer } from "../credit-notes/credit-note-issuer.service";
import { DisputeWorkflow } from "../disputes/dispute-workflow.service";

/** Annonce de revente renvoyée par le ticket-service. */
interface AdminResale {
  original_buyer_id: string;
  new_buyer_id: string | null;
  [key: string]: unknown;
}

/** Transfert renvoyé par le ticket-service (champs utiles à l'audit et aux emails). */
interface RevertedTransfer {
  id: string;
  ticket_id: string;
  ticket_reference: string;
  event_name: string;
  event_start_at: string;
  from_email: string;
  from_first_name: string;
  from_holder_first_name: string;
  from_holder_last_name: string;
  to_email: string;
  to_holder_first_name: string;
  to_holder_last_name: string;
  revert_reason?: string | null;
}

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
    private readonly eventRefund: EventRefundService,
    private readonly postponement: EventPostponementService,
    private readonly creditNotes: CreditNoteIssuer,
    private readonly disputes: DisputeWorkflow,
  ) {}

  private ip(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? ""
    );
  }

  /** Transferts de billets : qui, à qui, quand, depuis quelle IP ; filtrables par référence, email ou événement. */
  @Get("tickets/transfers")
  @ApiOperation({ summary: "Historique des billets offerts (tous les comptes)" })
  async listTicketTransfers(
    @Query("q") q?: string,
    @Query("event_id") eventId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await firstValueFrom(
      this.ticketClient.send("ticket.list_transfers", {
        q: q || undefined,
        event_id: eventId || undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    );
    return redactIpUnlessSuperAdmin(user, result);
  }

  /** Demandes d'annulation de transfert faites par les expéditeurs (file de traitement). */
  @Get("tickets/transfer-revert-requests")
  @ApiOperation({ summary: "Demandes d'annulation de transfert" })
  async listTransferRevertRequests(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const result = await firstValueFrom(
      this.ticketClient.send("ticket.list_transfer_revert_requests", {
        status: status || undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    );
    return redactIpUnlessSuperAdmin(user, result);
  }

  /** Annule un transfert : le billet revient à l'expéditeur avec un nouveau QR, le bénéficiaire le perd. */
  @Post("tickets/transfers/:id/revert")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler un transfert de billet (billet rendu à l'expéditeur)" })
  async revertTicketTransfer(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: RevertTransferDto,
    @Req() req: Request,
  ) {
    const { ticket, transfer } = await firstValueFrom(
      this.ticketClient.send<{ ticket: { id: string; reference: string }; transfer: RevertedTransfer }>("ticket.revert_transfer", {
        transfer_id: id,
        admin_id: user.sub,
        admin_email: user.email,
        reason: dto.reason,
        source: dto.source,
        request_id: dto.request_id,
      }),
    );

    this.audit(user, req, "TICKET_TRANSFER_REVERTED", "TICKET", ticket.id, transfer.revert_reason ?? undefined, {
      reference: ticket.reference,
      transfer_id: transfer.id,
      source: dto.source,
      request_id: dto.request_id ?? null,
      from_email: transfer.from_email,
      to_email: transfer.to_email,
      holder_before: `${transfer.to_holder_first_name} ${transfer.to_holder_last_name}`,
      holder_after: `${transfer.from_holder_first_name} ${transfer.from_holder_last_name}`,
      event_name: transfer.event_name,
    });

    this.notifClient.emit("notification.transfer_reverted", {
      ticketReference: transfer.ticket_reference,
      eventName: transfer.event_name,
      eventDate: formatEventDate(transfer.event_start_at),
      senderEmail: transfer.from_email,
      senderFirstName: transfer.from_first_name,
      recipientEmail: transfer.to_email,
      holderFirstName: transfer.from_holder_first_name,
      holderLastName: transfer.from_holder_last_name,
    });

    return { success: true, transfer };
  }

  /** Refuse la demande d'annulation de l'expéditeur : le transfert reste acquis. */
  @Post("tickets/transfer-revert-requests/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refuser une demande d'annulation de transfert" })
  async rejectTransferRevert(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: RejectTransferRevertDto,
    @Req() req: Request,
  ) {
    const { request, transfer } = await firstValueFrom(
      this.ticketClient.send<{ request: { id: string }; transfer: RevertedTransfer }>("ticket.reject_transfer_revert", {
        request_id: id,
        admin_id: user.sub,
        admin_email: user.email,
        reason: dto.reason,
      }),
    );

    this.audit(user, req, "TICKET_TRANSFER_REVERT_REJECTED", "TICKET", transfer.ticket_id, dto.reason, {
      reference: transfer.ticket_reference,
      transfer_id: transfer.id,
      request_id: request.id,
      from_email: transfer.from_email,
      to_email: transfer.to_email,
      event_name: transfer.event_name,
    });
    this.notifClient.emit("notification.transfer_revert_rejected", {
      ticketReference: transfer.ticket_reference,
      eventName: transfer.event_name,
      eventDate: formatEventDate(transfer.event_start_at),
      senderEmail: transfer.from_email,
      senderFirstName: transfer.from_first_name,
      recipientEmail: transfer.to_email,
      decisionReason: dto.reason,
    });

    return { success: true, request };
  }

  /** Toutes les reventes, avec recherche par billet, événement, vendeur ou acheteur. */
  @Get("resales")
  @ApiOperation({ summary: "Historique des reventes de billets" })
  async listResales(
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const query = q?.trim() || undefined;
    // Comptes dont le nom ou l'email correspond : l'annonce ne stocke que
    // leurs identifiants (vendeur / acheteur).
    const matchingAccounts = query
      ? await firstValueFrom(
          this.authClient.send<{ data: Array<{ id: string }> }>("auth.list_users", { q: query, limit: 100 }),
        ).catch(() => ({ data: [] }))
      : { data: [] };
    const result = await firstValueFrom(
      this.ticketClient.send<{ data: AdminResale[]; total: number; page: number; limit: number }>("ticket.list_resales_admin", {
        status: status || undefined,
        q: query,
        user_ids: matchingAccounts.data.map((account) => account.id),
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    );
    return { ...result, data: await this.withAccounts(result.data) };
  }

  /** Reventes où ce compte est vendeur ou acheteur. */
  @Get("users/:id/resales")
  @ApiOperation({ summary: "Reventes d'un compte (vendeur ou acheteur)" })
  async getUserResales(@Param("id", UuidPipe) id: string) {
    const resales = await firstValueFrom(this.ticketClient.send<AdminResale[]>("ticket.resales_by_user", { user_id: id }));
    return this.withAccounts(resales);
  }

  /** Ajoute nom et email du vendeur et de l'acheteur (auth-service). */
  private async withAccounts(resales: AdminResale[]) {
    const ids = [...new Set(resales.flatMap((resale) => [resale.original_buyer_id, resale.new_buyer_id]).filter(Boolean))] as string[];
    const accounts = ids.length
      ? await firstValueFrom(
          this.authClient.send<Array<{ id: string; email: string; first_name: string; last_name: string }>>(
            "auth.get_users_by_ids",
            { ids },
          ),
        ).catch(() => [])
      : [];
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const summary = (userId: string | null) => {
      const account = userId ? byId.get(userId) : undefined;
      return account ? { email: account.email, first_name: account.first_name, last_name: account.last_name } : null;
    };
    return resales.map((resale) => ({
      ...resale,
      seller: summary(resale.original_buyer_id),
      buyer: summary(resale.new_buyer_id),
    }));
  }

  /** Chaîne complète des titulaires d'un billet. */
  @Get("tickets/:id/transfers")
  @ApiOperation({ summary: "Historique des titulaires d'un billet" })
  async getTicketTransfers(@Param("id", UuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return redactIpUnlessSuperAdmin(
      user,
      await firstValueFrom(this.ticketClient.send("ticket.transfers_by_ticket", { ticket_id: id })),
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
  async getStats(@CurrentUser() user?: JwtPayload) {
    return redactIpUnlessSuperAdmin(user, await firstValueFrom(this.adminClient.send("admin.get_stats", {})));
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

  /** Tendance des ventes sur une plage de dates, séparée du dashboard pour ne recharger que le graphique. */
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
  async getLogs(@Query() query: AuditLogsQueryDto, @CurrentUser() user?: JwtPayload) {
    const logs = await firstValueFrom(
      this.adminClient.send("admin.get_logs", {
        entity_type: query.entity_type,
        entity_id: query.entity_id,
        performed_by: query.performed_by,
        action: query.action,
        q: query.q || undefined,
        search_ip: user?.role === "SUPER_ADMIN",
        from: query.from,
        to: query.to,
        limit: query.limit,
        offset: query.offset,
      }),
    );
    return redactIpUnlessSuperAdmin(user, logs);
  }

  // ─── Gestion des utilisateurs ─────────────────────────────────────────────────

  @Get("users")
  @ApiOperation({
    summary:
      "Recherche/liste globale des utilisateurs (email, nom, rôle, statut)",
  })
  searchUsers(@Query() query: AdminUsersQueryDto) {
    return firstValueFrom(
      this.authClient.send("auth.list_users", {
        q: query.q,
        role: query.role,
        is_suspended: query.is_suspended === undefined ? undefined : query.is_suspended === "true",
        status: query.status,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }

  /** CDC §9 : le titulaire est prévenu de chaque action admin sur son compte. */
  /** Détail d'un compte, avec le profil organisateur (IBAN, KYC) quand le rôle le justifie. */
  @Get("users/:id")
  @ApiOperation({ summary: "Détail d'un utilisateur (+ profil organisateur si applicable)" })
  async getUserDetail(@Param("id", UuidPipe) id: string) {
    const user = (await firstValueFrom(
      this.authClient.send("auth.get_user", { id }),
    )) as { role: string };

    const organizerProfile =
      user.role === "ORGANIZER"
        ? await firstValueFrom(
            this.userClient.send("user.get_organizer_profile", { user_id: id }),
          ).catch(() => null)
        : null;

    return { user, organizer_profile: organizerProfile };
  }

  /** Commandes d'un acheteur, pour le renvoi de billets depuis la fiche compte. */
  @Get("users/:id/transfers")
  @ApiOperation({ summary: "Billets offerts et reçus par ce compte" })
  async getUserTransfers(@Param("id", UuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return redactIpUnlessSuperAdmin(
      user,
      await firstValueFrom(this.ticketClient.send("ticket.transfers_by_user", { user_id: id })),
    );
  }

  @Get("users/:id/orders")
  @ApiOperation({ summary: "Commandes passées par cet acheteur" })
  getUserOrders(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.orderClient.send("order.list_by_buyer", { buyer_id: id }),
    );
  }

  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Suspendre un compte utilisateur" })
  async suspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.suspend_user", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
        actor_role: user.role,
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
    @Param("id", UuidPipe) id: string,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.unsuspend_user", {
        id,
        admin_id: user.sub,
        actor_role: user.role,
      }),
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
    @Param("id", UuidPipe) id: string,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.unlock_account", {
        id,
        admin_id: user.sub,
        actor_role: user.role,
      }),
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
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException("Un motif est requis pour réinitialiser la 2FA d'un compte.");
    }
    const result = (await firstValueFrom(
      this.authClient.send("auth.2fa.reset_by_admin", {
        user_id: id,
        admin_id: user.sub,
        reason: dto.reason,
        actor_role: user.role,
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
    @Param("id", UuidPipe) id: string,
  ) {
    const result = (await firstValueFrom(
      this.authClient.send("auth.activate_account", {
        id,
        admin_id: user.sub,
        actor_role: user.role,
      }),
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
    @Param("id", UuidPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    const result = await firstValueFrom(
      this.authClient.send("auth.change_role", {
        id,
        role: dto.role,
        admin_id: user.sub,
        actor_role: user.role,
      }),
    );
    this.audit(user, req, "USER_ROLE_CHANGED", "USER", id, undefined, {
      new_role: dto.role,
    });
    return result;
  }

  // ─── Modération des événements ────────────────────────────────────────────────

  /** Accueil physique : l'admin crée l'événement en brouillon sous le compte d'un organisateur existant. */
  @Post("events")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Créer un événement au nom d'un organisateur (accueil physique)" })
  async createEventForOrganizer(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() body: CreateEventForOrganizerDto,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.create", { organizer_id: body.organizer_id, dto: body.dto }),
    );
    this.audit(user, req, "CUSTOM", "EVENT", (result as { id: string }).id, `Événement créé par l'admin pour l'organisateur ${body.organizer_id} (accueil physique)`);
    this.notifyOrganizerOfEvent(result as { id: string; title: string; organizer_id: string }, "CREATED_FOR_YOU");
    return result;
  }

  @Post("events/:id/categories")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Ajouter une catégorie de billet à un événement créé pour un organisateur (accueil physique)" })
  createCategoryForOrganizer(
    @Param("id", UuidPipe) id: string,
    @Body() body: CreateCategoryForOrganizerDto,
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
  submitEventForOrganizer(@Param("id", UuidPipe) id: string, @Body() body: OrganizerRefDto) {
    return firstValueFrom(
      this.eventClient.send("event.submit_for_validation", { id, organizer_id: body.organizer_id }),
    );
  }

  /** Liste admin réelle de tous les événements, tous statuts. */
  /** Enrichissement (organisateur, catégorie, remplissage) par lot pour la liste et la fiche détail. */
  private async enrichAdminEvents<
    T extends { id: string; organizer_id: string; category: string },
  >(events: T[]): Promise<
    Array<T & { organizer_name: string; category_label: string; category_emoji: string | null; sold: number; total_quota: number }>
  > {
    const organizerIds = [...new Set(events.map((event) => event.organizer_id))];
    const [organizers, categories, fillStatsList] = await Promise.all([
      firstValueFrom(
        this.authClient.send("auth.get_users_by_ids", { ids: organizerIds }),
      ).catch(() => []) as Promise<Array<{ id: string; first_name: string; last_name: string; email: string }>>,
      firstValueFrom(this.eventClient.send("event.category.list_all", {})).catch(
        () => [],
      ) as Promise<Array<{ code: string; label: string; emoji: string | null }>>,
      // Un aller-retour par événement, le volume admin restant modeste.
      Promise.all(
        events.map((event) =>
          firstValueFrom(this.eventClient.send("event.get_fill_stats", { event_id: event.id })).catch(
            () => ({ total_quota: 0, sold: 0 }),
          ),
        ),
      ) as Promise<Array<{ total_quota: number; sold: number }>>,
    ]);

    const organizerById = new Map(organizers.map((organizer) => [organizer.id, organizer]));
    const categoryByCode = new Map(categories.map((category) => [category.code, category]));

    return events.map((event, index) => {
      const organizer = organizerById.get(event.organizer_id);
      const category = categoryByCode.get(event.category);
      const fillStats = fillStatsList[index];
      return {
        ...event,
        organizer_name: organizer ? `${organizer.first_name} ${organizer.last_name}` : "Organisateur introuvable",
        category_label: category?.label ?? event.category,
        category_emoji: category?.emoji ?? null,
        sold: fillStats.sold,
        total_quota: fillStats.total_quota,
      };
    });
  }

  /** Liste admin réelle de tous les événements, tous statuts. */
  @Get("events")
  @ApiOperation({ summary: "Tous les événements, tous statuts confondus (gestion globale)" })
  async listAllEvents(@Query() query: AdminEventsQueryDto) {
    // Recherche aussi par organisateur : ses comptes (nom, email) sont dans
    // auth-service, on transmet leurs identifiants à event-service.
    const search = query.q?.trim();
    const organizers = search
      ? ((await firstValueFrom(this.authClient.send("auth.list_users", { q: search, limit: 100 })).catch(
          () => ({ data: [] }),
        )) as { data: Array<{ id: string }> })
      : { data: [] };

    const result = (await firstValueFrom(
      this.eventClient.send("event.list_all", {
        status: query.status || undefined,
        category: query.category || undefined,
        when: query.when,
        q: search || undefined,
        organizer_ids: organizers.data.map((user) => user.id),
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    )) as { data: Array<{ id: string; organizer_id: string; category: string; [key: string]: unknown }>; total: number };
    return { data: await this.enrichAdminEvents(result.data), total: result.total };
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

  // Fiche détail admin d'un événement ; déclarée après « events/pending » pour ne pas l'avaler comme un id.
  /** Tout ce qu'il faut pour consulter ou agir sur un événement ; chaque source est facultative. */
  @Get("events/:id/overview")
  @ApiOperation({ summary: "Vue complète d'un événement pour l'administration" })
  async getAdminEventOverview(@Param("id", UuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    const event = (await firstValueFrom(this.eventClient.send("event.get", { id }))) as {
      id: string;
      organizer_id: string;
    };
    const soft = <T>(pattern: string, client: ClientProxy, payload: unknown, fallback: T): Promise<T> =>
      firstValueFrom(client.send(pattern, payload)).catch(() => fallback) as Promise<T>;

    const [organizer, fillStats, revenue, ticketStats, ticketCategories, payouts, attendees, validationRequests, history] =
      await Promise.all([
        soft<Record<string, unknown> | null>("auth.get_user", this.authClient, { id: event.organizer_id }, null),
        soft("event.get_fill_stats", this.eventClient, { event_id: id }, { total_quota: 0, remaining: 0, sold: 0, fill_rate: 0, categories: [] }),
        soft("order.get_revenue_by_event", this.orderClient, { event_id: id }, {
          orders_count: 0,
          revenue_ht: 0,
          revenue_ttc: 0,
          total_commission: 0,
          net_organizer_amount: 0,
        }),
        soft("ticket.get_stats_by_event", this.ticketClient, { event_id: id }, { total: 0, used: 0, active: 0, cancelled: 0, for_resale: 0 }),
        soft("event.get_categories", this.eventClient, { event_id: id }, []),
        soft<Array<{ event_id: string }>>("payment.get_payouts_by_organizer", this.paymentClient, { organizer_id: event.organizer_id }, []),
        soft("ticket.get_by_event", this.ticketClient, { event_id: id }, []),
        soft("event.get_validation_requests", this.eventClient, { event_id: id }, []),
        soft<{ logs: unknown[] }>("admin.get_logs", this.adminClient, { entity_id: id, limit: 100 }, { logs: [] }),
      ]);

    const contact = organizer
      ? {
          id: organizer.id,
          first_name: organizer.first_name,
          last_name: organizer.last_name,
          email: organizer.email,
          phone: organizer.phone ?? null,
          is_suspended: organizer.is_suspended ?? false,
        }
      : null;

    return {
      organizer: contact,
      fill_stats: fillStats,
      revenue,
      tickets: ticketStats,
      ticket_categories: ticketCategories,
      payout: payouts.find((payout) => payout.event_id === id) ?? null,
      attendees,
      validation_requests: validationRequests,
      history: redactIpUnlessSuperAdmin(user, history.logs),
    };
  }

  @Get("events/:id")
  @ApiOperation({ summary: "Détail enrichi d'un événement (gestion globale)" })
  async getAdminEvent(@Param("id", UuidPipe) id: string) {
    const event = (await firstValueFrom(this.eventClient.send("event.get", { id }))) as {
      id: string;
      organizer_id: string;
      category: string;
      [key: string]: unknown;
    };
    const [enriched] = await this.enrichAdminEvents([event]);
    return enriched;
  }

  @Post("events/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approuver un événement" })
  async approveEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.validate", { id, admin_id: user.sub }),
    );
    this.audit(user, req, "EVENT_APPROVED", "EVENT", id);
    // Notification organisateur envoyée par event-service (validate()) — pas de doublon ici.
    return result;
  }

  /** CDC §3.2 : vérification admin du justificatif « but non lucratif », avant l'approbation de l'événement. */
  @Post("events/:id/verify-non-profit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vérifier le justificatif \"à but non lucratif\" d'un événement" })
  async verifyEventNonProfit(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: VerifyNonProfitDto,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.verify_non_profit", {
        id,
        admin_id: user.sub,
        approved: dto.approved,
        reason: dto.approved ? undefined : dto.reason,
      }),
    );
    this.audit(
      user,
      req,
      dto.approved ? "EVENT_NON_PROFIT_VERIFIED" : "EVENT_NON_PROFIT_REJECTED",
      "EVENT",
      id,
    );
    this.notifyOrganizerOfEvent(
      result as { id: string; title: string; organizer_id: string },
      dto.approved ? "NON_PROFIT_VERIFIED" : "NON_PROFIT_REJECTED",
      dto.approved ? null : dto.reason,
    );
    return result;
  }

  @Post("events/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rejeter un événement" })
  async rejectEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
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
    @Param("id", UuidPipe) id: string,
    @Body() dto: MessageDto,
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

  /** Annulation directe par un admin : événement annulé, acheteurs remboursés. */
  @Post("events/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler un événement et rembourser les acheteurs (ADMIN)" })
  async cancelEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    const reason = dto?.reason?.trim();
    if (!reason) throw new BadRequestException("Le motif de l'annulation est obligatoire.");
    const event = (await firstValueFrom(
      this.eventClient.send("event.cancel", { id, actor_id: user.sub, dto: { reason }, is_admin: true }),
    )) as CancelledEventSnapshot;
    this.eventRefund.refundInBackground(event, reason);
    this.audit(user, req, "EVENT_CANCELED", "EVENT", id, reason);
    this.notifyOrganizerOfEvent(event, "CANCELLED_BY_ADMIN", reason);
    return event;
  }

  /** Désactivation : ventes bloquées, la page publique affiche le message. */
  @Post("events/:id/suspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Désactiver un événement avec un message public (ADMIN)" })
  async suspendEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send("event.suspend", { id, admin_id: user.sub, dto: { reason: dto?.reason } }),
    );
    this.audit(user, req, "EVENT_SUSPENDED", "EVENT", id, dto?.reason);
    return result;
  }

  @Post("events/:id/unsuspend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Réactiver un événement désactivé (ADMIN)" })
  async unsuspendEvent(@CurrentUser() user: JwtPayload, @Req() req: Request, @Param("id", UuidPipe) id: string) {
    const result = (await firstValueFrom(this.eventClient.send("event.unsuspend", { id }))) as {
      id: string;
      title: string;
      organizer_id: string;
    };
    this.audit(user, req, "CUSTOM", "EVENT", id, "Événement réactivé : les ventes reprennent.");
    this.notifyOrganizerOfEvent(result, "UNSUSPENDED");
    return result;
  }

  /** Masquage : hors catalogue, page publique indisponible, ventes bloquées. */
  @Post("events/:id/hide")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Masquer un événement au public (ADMIN)" })
  async hideEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    const result = (await firstValueFrom(
      this.eventClient.send("event.hide", { id, admin_id: user.sub, dto: { reason: dto?.reason } }),
    )) as { id: string; title: string; organizer_id: string };
    this.audit(user, req, "CUSTOM", "EVENT", id, `Événement masqué au public : ${dto?.reason ?? ""}`);
    this.notifyOrganizerOfEvent(result, "HIDDEN", dto?.reason);
    return result;
  }

  @Post("events/:id/vat-rate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Corriger le taux de TVA d'un événement avant sa publication (ADMIN)" })
  async setEventVatRate(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: SetEventVatRateDto,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send<{ vat_rate: string; vat_rate_label: string | null }>("event.set_vat_rate", {
        id,
        admin_id: user.sub,
        vat_rate_id: dto.vat_rate_id,
      }),
    );
    const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(result.vat_rate) * 100);
    this.audit(user, req, "CUSTOM", "EVENT", id, `Taux de TVA corrigé : ${percent} %${result.vat_rate_label ? ` — ${result.vat_rate_label}` : ""}`);
    return result;
  }

  @Post("events/:id/feature")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mettre un événement « À la une » de l'accueil (ADMIN)" })
  async featureEvent(@CurrentUser() user: JwtPayload, @Req() req: Request, @Param("id", UuidPipe) id: string) {
    const result = await firstValueFrom(this.eventClient.send("event.feature", { id, admin_id: user.sub }));
    this.audit(user, req, "CUSTOM", "EVENT", id, "Événement mis à la une de l'accueil.");
    return result;
  }

  @Post("events/:id/unfeature")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retirer un événement de « À la une » (ADMIN)" })
  async unfeatureEvent(@CurrentUser() user: JwtPayload, @Req() req: Request, @Param("id", UuidPipe) id: string) {
    const result = await firstValueFrom(this.eventClient.send("event.unfeature", { id }));
    this.audit(user, req, "CUSTOM", "EVENT", id, "Événement retiré de la une de l'accueil.");
    return result;
  }

  @Post("events/:id/unhide")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rendre un événement de nouveau visible (ADMIN)" })
  async unhideEvent(@CurrentUser() user: JwtPayload, @Req() req: Request, @Param("id", UuidPipe) id: string) {
    const result = (await firstValueFrom(this.eventClient.send("event.unhide", { id }))) as {
      id: string;
      title: string;
      organizer_id: string;
    };
    this.audit(user, req, "CUSTOM", "EVENT", id, "Événement de nouveau visible au public.");
    this.notifyOrganizerOfEvent(result, "UNHIDDEN");
    return result;
  }

  /** Prévient l'organisateur par email d'une action admin sur son événement, sans bloquer l'action. */
  private notifyOrganizerOfEvent(
    event: { id: string; title?: string; organizer_id?: string } | null | undefined,
    kind: string,
    message?: string | null,
  ): void {
    if (!event?.id) return;
    (async () => {
      const full = event.title && event.organizer_id
        ? (event as { id: string; title: string; organizer_id: string })
        : ((await firstValueFrom(this.eventClient.send("event.get", { id: event.id }))) as {
            id: string;
            title: string;
            organizer_id: string;
          });
      const organizer = (await firstValueFrom(this.authClient.send("auth.get_user", { id: full.organizer_id }))) as {
        email?: string;
        first_name?: string;
      } | null;
      if (!organizer?.email) return;
      this.notifClient.emit("notification.organizer_event_notice", {
        email: organizer.email,
        firstName: organizer.first_name ?? "",
        event_id: full.id,
        event_name: full.title,
        kind,
        message: message ?? undefined,
      });
    })().catch(() => undefined);
  }

  // ─── Demandes d'annulation des organisateurs ─────────────────────────────────

  /** Ajoute le nom et l'email de l'organisateur à chaque demande. */
  private async enrichCancellationRequests<T extends { organizer_id: string }>(requests: T[]) {
    const ids = [...new Set(requests.map((request) => request.organizer_id))];
    const organizers = (ids.length
      ? await firstValueFrom(this.authClient.send("auth.get_users_by_ids", { ids })).catch(() => [])
      : []) as Array<{ id: string; first_name: string; last_name: string; email: string }>;
    const byId = new Map(organizers.map((organizer) => [organizer.id, organizer]));
    return requests.map((request) => {
      const organizer = byId.get(request.organizer_id);
      return {
        ...request,
        organizer_name: organizer ? `${organizer.first_name} ${organizer.last_name}` : null,
        organizer_email: organizer?.email ?? null,
      };
    });
  }

  @Get("cancellation-requests")
  @ApiOperation({ summary: "Demandes d'annulation des organisateurs (ADMIN)" })
  async listCancellationRequests(@Query() query: CancellationRequestsQueryDto) {
    const result = (await firstValueFrom(
      this.eventClient.send("event.cancellation.list_admin", {
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      }),
    )) as { data: Array<{ organizer_id: string }>; total: number };
    return { data: await this.enrichCancellationRequests(result.data), total: result.total };
  }

  @Get("cancellation-requests/pending-count")
  @ApiOperation({ summary: "Nombre de demandes d'annulation en attente (ADMIN)" })
  async pendingCancellationCount() {
    return { count: await firstValueFrom(this.eventClient.send("event.cancellation.count_pending", {})) };
  }

  @Get("events/:id/cancellation-requests")
  @ApiOperation({ summary: "Historique des demandes d'annulation d'un événement (ADMIN)" })
  async eventCancellationRequests(@Param("id", UuidPipe) id: string) {
    const requests = (await firstValueFrom(
      this.eventClient.send("event.cancellation.list_by_event", { event_id: id }),
    )) as Array<{ organizer_id: string }>;
    return this.enrichCancellationRequests(requests);
  }

  @Post("cancellation-requests/:id/messages")
  @ApiOperation({ summary: "Répondre à l'organisateur dans l'échange (ADMIN)" })
  async postCancellationMessage(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: MessageDto,
  ) {
    const request = (await firstValueFrom(
      this.eventClient.send("event.cancellation.message", {
        id,
        author_id: user.sub,
        author_role: "ADMIN",
        message: dto?.message,
      }),
    )) as { organizer_id: string; event_id: string; kind?: string };
    this.notifyOrganizerOfEvent(
      { id: request.event_id },
      request.kind === "POSTPONEMENT" ? "POSTPONEMENT_MESSAGE" : "CANCELLATION_MESSAGE",
      dto?.message,
    );
    const [enriched] = await this.enrichCancellationRequests([request]);
    return enriched;
  }

  @Post("cancellation-requests/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refuser une demande d'annulation, avec un message (ADMIN)" })
  async rejectCancellation(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: MessageDto,
  ) {
    const request = (await firstValueFrom(
      this.eventClient.send("event.cancellation.reject", { id, admin_id: user.sub, message: dto?.message }),
    )) as { organizer_id: string; event_id: string; kind?: string };
    const postponement = request.kind === "POSTPONEMENT";
    this.audit(
      user,
      req,
      "CUSTOM",
      "EVENT",
      request.event_id,
      `Demande ${postponement ? "de report" : "d'annulation"} refusée : ${dto?.message ?? ""}`,
    );
    this.notifyOrganizerOfEvent(
      { id: request.event_id },
      postponement ? "POSTPONEMENT_REJECTED" : "CANCELLATION_REJECTED",
      dto?.message,
    );
    const [enriched] = await this.enrichCancellationRequests([request]);
    return enriched;
  }

  @Post("cancellation-requests/:id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Accepter une demande : annulation (acheteurs remboursés) ou report (acheteurs prévenus, remboursement sur demande) (ADMIN)",
  })
  async approveCancellation(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: OptionalMessageDto,
  ) {
    const result = (await firstValueFrom(
      this.eventClient.send("event.cancellation.approve", { id, admin_id: user.sub, message: dto?.message }),
    )) as { request: { organizer_id: string; reason: string; kind?: string }; event: CancelledEventSnapshot & PostponedEvent };
    const organizerEvent = result.event as unknown as { id: string; title: string; organizer_id: string };
    if (result.request.kind === "POSTPONEMENT") {
      this.postponement.announceInBackground(result.event, "POSTPONED");
      this.audit(user, req, "CUSTOM", "EVENT", result.event.id, `Report accepté : ${result.request.reason}`);
      this.notifyOrganizerOfEvent(organizerEvent, "POSTPONEMENT_APPROVED", dto?.message);
    } else {
      this.eventRefund.refundInBackground(result.event, result.request.reason);
      this.audit(user, req, "EVENT_CANCELED", "EVENT", result.event.id, `Demande de l'organisateur acceptée : ${result.request.reason}`);
      this.notifyOrganizerOfEvent(organizerEvent, "CANCELLATION_APPROVED", dto?.message);
    }
    const [enriched] = await this.enrichCancellationRequests([result.request]);
    return enriched;
  }

  // ─── Gestion des billets ──────────────────────────────────────────────────────

  @Post("tickets/:id/invalidate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Invalider un billet" })
  async invalidateTicket(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
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

  @Get("payouts/stats")
  @ApiOperation({ summary: "KPIs reversements (en attente / versé ce mois / bloqué)" })
  getPayoutStats() {
    return firstValueFrom(this.paymentClient.send("payment.get_payout_stats", {}));
  }

  /** Liste enrichie (organisateur, événement) résolue par lot. */
  private async enrichPayouts<T extends { organizer_id: string; event_id: string }>(
    payouts: T[],
  ): Promise<Array<T & { organizer_name: string; organizer_email: string | null; event_name: string }>> {
    const organizerIds = [...new Set(payouts.map((p) => p.organizer_id))];
    const eventIds = [...new Set(payouts.map((p) => p.event_id))];

    const [organizers, events] = await Promise.all([
      organizerIds.length
        ? firstValueFrom(
            this.authClient.send<Array<{ id: string; first_name: string; last_name: string; email: string }>>(
              "auth.get_users_by_ids",
              { ids: organizerIds },
            ),
            // Noms indisponibles : la liste financière s'affiche quand même.
          ).catch(() => [])
        : Promise.resolve([]),
      eventIds.length
        ? firstValueFrom(
            this.eventClient.send<Array<{ id: string; title: string }>>("event.get_by_ids", { ids: eventIds }),
          ).catch(() => [])
        : Promise.resolve([]),
    ]);
    const organizerById = new Map(organizers.map((o) => [o.id, o]));
    const eventById = new Map(events.map((e) => [e.id, e]));

    return payouts.map((payout) => {
      const organizer = organizerById.get(payout.organizer_id);
      const event = eventById.get(payout.event_id);
      return {
        ...payout,
        organizer_name: organizer ? `${organizer.first_name} ${organizer.last_name}` : "Organisateur introuvable",
        organizer_email: organizer?.email ?? null,
        event_name: event?.title ?? "Événement introuvable",
      };
    });
  }

  @Get("payouts")
  @ApiOperation({ summary: "Liste des reversements, tous organisateurs confondus" })
  async listPayouts(@Query() query: AdminPayoutsQueryDto) {
    // Recherche par organisateur (auth-service) ou par événement
    // (event-service) : leurs identifiants filtrent ensuite les reversements.
    const search = query.q?.trim();
    let searchIds: { organizer_ids?: string[]; event_ids?: string[] } = {};
    if (search) {
      const [organizers, events] = await Promise.all([
        firstValueFrom(this.authClient.send("auth.list_users", { q: search, limit: 100 })).catch(() => ({ data: [] })),
        firstValueFrom(this.eventClient.send("event.list_all", { q: search, limit: 100 })).catch(() => ({ data: [] })),
      ]) as [{ data: Array<{ id: string }> }, { data: Array<{ id: string }> }];
      searchIds = {
        organizer_ids: organizers.data.map((user) => user.id),
        event_ids: events.data.map((event) => event.id),
      };
    }

    const result = (await firstValueFrom(
      this.paymentClient.send("payment.list_all_payouts", {
        status: query.status,
        ...searchIds,
        scheduled_from: query.scheduled_from || undefined,
        scheduled_to: query.scheduled_to || undefined,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
      }),
    )) as {
      data: Array<{ id: string; organizer_id: string; event_id: string }>;
      total: number;
    };

    return { total: result.total, data: await this.enrichPayouts(result.data) };
  }

  @Get("payouts/:id")
  @ApiOperation({ summary: "Détail d'un reversement" })
  async getPayoutDetail(@Param("id", UuidPipe) id: string) {
    const payout = (await firstValueFrom(
      this.paymentClient.send("payment.get_payout", { id }),
    )) as { organizer_id: string; event_id: string };

    const [enriched] = await this.enrichPayouts([payout]);

    const account = await firstValueFrom(
      this.userClient.send("user.get_payout_account", { user_id: payout.organizer_id }),
    ).catch(() => null) as { bank_owner_name: string | null; iban_masked: string | null; payout_method: string } | null;

    return {
      ...enriched,
      bank_owner_name: account?.bank_owner_name ?? null,
      iban_masked: account?.iban_masked ?? null,
      payout_method: account?.payout_method ?? null,
    };
  }

  @Post("payouts/:id/block")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bloquer un reversement" })
  async blockPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
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
    @Param("id", UuidPipe) id: string,
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send("payment.unblock_payout", { id }),
    );
    this.audit(user, req, "PAYOUT_UNBLOCKED", "PAYOUT", id);
    return result;
  }

  /** Versement manuel d'un reversement, avec les mêmes vérifications que le cycle automatique. */
  @Post("payouts/:id/process")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Déclencher manuellement le virement d'un reversement" })
  async processPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
  ) {
    const payout = await firstValueFrom(
      this.paymentClient.send("payment.get_payout", { id }),
    );

    const profile = await firstValueFrom(
      this.userClient.send("user.get_payout_account", {
        user_id: payout.organizer_id,
      }),
    );
    if (profile?.kyc_status !== "VERIFIED") {
      throw new BadRequestException("KYC non validé pour cet organisateur");
    }
    if (profile.payout_method === "BANK_TRANSFER") {
      if (!profile.has_iban) throw new BadRequestException("Aucun IBAN enregistré pour cet organisateur");
      const config = await firstValueFrom(
        this.adminClient.send<{ iban_change_payout_hold_hours: number }>("admin.get_platform_config", {}),
      );
      const holdUntil = profile.iban_updated_at
        ? new Date(profile.iban_updated_at).getTime() + config.iban_change_payout_hold_hours * 3_600_000
        : 0;
      if (holdUntil > Date.now()) {
        throw new BadRequestException(
          `IBAN modifié récemment : reversements suspendus jusqu'au ${new Date(holdUntil).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.`,
        );
      }
      const prepared = await firstValueFrom(this.paymentClient.send("payment.prepare_bank_transfer", { id }));
      this.audit(user, req, "PAYOUT_PROCESSED_MANUALLY", "PAYOUT", id);
      return prepared;
    }
    if (!profile.stripe_connect_account_id || !profile.stripe_connect_onboarded) {
      throw new BadRequestException(
        "Compte Stripe Connect non configuré pour cet organisateur",
      );
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
    @Param("id", UuidPipe) id: string,
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
  @ApiOperation({ summary: "Tous les litiges, avec commande, événement et acheteur" })
  getAllDisputes(@Query("order_id") order_id?: string) {
    if (order_id) {
      return firstValueFrom(this.paymentClient.send("payment.get_disputes_by_order", { order_id }));
    }
    return this.disputes.listForAdmin();
  }

  @Get("disputes/:id")
  @ApiOperation({ summary: "Fiche d'un litige : commande, billets, paiement, avoirs" })
  getDispute(@Param("id", UuidPipe) id: string) {
    return this.disputes.detail(id);
  }

  @Post("disputes/:id/review")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Prendre un litige en charge" })
  async reviewDispute(@CurrentUser() user: JwtPayload, @Req() req: Request, @Param("id", UuidPipe) id: string) {
    const result = await this.disputes.startReview(id);
    this.audit(user, req, "CUSTOM", "DISPUTE", id, "Litige pris en charge");
    return result;
  }

  @Post("disputes/:id/resolve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Trancher un litige, avec remboursement éventuel de l'acheteur" })
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    const result = await this.disputes.resolve(user.sub, id, dto);
    this.audit(user, req, "DISPUTE_RESOLVED", "DISPUTE", id, dto.resolution_notes, {
      status: dto.status,
      refund_full: dto.refund_full ?? false,
      refund_amount_cents: dto.refund_amount_cents ?? null,
    });
    return result;
  }

  // ─── KYC organisateurs ───────────────────────────────────────────────────────

  @Get("kyc/pending")
  @ApiOperation({
    summary: "Profils organisateurs en attente de vérification KYC",
  })
  async getPendingKyc() {
    const profiles = await firstValueFrom(
      this.userClient.send<Array<{ user_id: string; display_name: string; kyc_submitted_at: string | null }>>(
        "user.list_kyc_pending",
        {},
      ),
    );
    if (profiles.length === 0) return [];
    const accounts = (await firstValueFrom(
      this.authClient.send("auth.get_users_by_ids", { ids: profiles.map((profile) => profile.user_id) }),
    ).catch(() => [])) as Array<{ id: string; first_name: string; last_name: string; email: string }>;
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return profiles.map((profile) => {
      const account = byId.get(profile.user_id);
      return {
        user_id: profile.user_id,
        display_name: profile.display_name,
        kyc_submitted_at: profile.kyc_submitted_at,
        owner_name: account ? `${account.first_name} ${account.last_name}` : null,
        owner_email: account?.email ?? null,
      };
    });
  }

  @Get("kyc/pending-count")
  @ApiOperation({ summary: "Nombre de vérifications KYC en attente (pastille du menu admin)" })
  async pendingKycCount() {
    const profiles = await firstValueFrom(this.userClient.send<unknown[]>("user.list_kyc_pending", {}));
    return { count: profiles.length };
  }

  @Post("kyc/:userId/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approuver le KYC d'un organisateur" })
  async approveKyc(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("userId", UuidPipe) userId: string,
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
    @Param("userId", UuidPipe) userId: string,
    @Body() dto: ReasonDto,
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
  getPlatformConfig(@CurrentUser() user: JwtPayload) {
    // Les sections sensibles ne sont renvoyées qu'au super admin.
    return firstValueFrom(
      this.adminClient.send("admin.list_platform_settings", { actor_role: user.role }),
    );
  }

  @Patch("config/:key")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Modifier un paramètre de la plateforme" })
  async updatePlatformConfig(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("key") key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    const result = await firstValueFrom(
      this.adminClient.send<{ key: string; value: string; previous_value: string }>("admin.update_platform_setting", {
        key,
        value: dto.value,
        actor_role: user.role,
      }),
    );
    this.audit(
      user,
      req,
      "PLATFORM_SETTING_UPDATED",
      "SETTING",
      key,
      undefined,
      { key, previous_value: result.previous_value, value: result.value },
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
    @Body() dto: SendNewsletterDto,
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

  // ─── Support commandes ──────────────────────────────────────────────────────

  /** Renvoi des billets par le support au nom d'un acheteur (même logique que la route acheteur). */
  @Post("orders/:id/resend-tickets")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renvoyer l'email des billets d'une commande, au nom du support" })
  async resendOrderTickets(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("id", UuidPipe) id: string,
  ) {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id }),
    )) as {
      order: {
        buyer_email: string;
        buyer_first_name: string;
        event_name: string;
        event_start_at: string;
        event_venue_name: string;
        status: string;
      };
    };

    if (!["CONFIRMED", "TICKETS_SENT"].includes(order.status)) {
      throw new BadRequestException(
        "Aucun billet disponible pour cette commande dans son état actuel",
      );
    }

    const tickets = (await firstValueFrom(
      this.ticketClient.send("ticket.get_by_order", { order_id: id }),
    )) as Array<{
      reference: string;
      ticket_category_name: string;
      seat_info: string | null;
    }>;

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

    this.audit(user, req, "CUSTOM", "ORDER", id, "Billets renvoyés par le support");

    return { success: true };
  }

  // ─── Remboursement forcé ──────────────────────────────────────────────────────

  @Post("orders/:orderId/force-refund")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Forcer un remboursement (ADMIN)" })
  async forceRefund(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param("orderId", UuidPipe) orderId: string,
    @Body() dto: ForceRefundDto,
  ) {
    const result = await this.disputes.refundOrder(orderId, dto.amount_cents, dto.reason);
    this.audit(user, req, "REFUND_FORCED", "ORDER", orderId, dto.reason, {
      amount_cents: dto.amount_cents,
    });
    return result;
  }

}
