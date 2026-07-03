import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    @Inject('ADMIN_SERVICE')   private readonly adminClient: ClientProxy,
    @Inject('USER_SERVICE')    private readonly userClient: ClientProxy,
    @Inject('EVENT_SERVICE')   private readonly eventClient: ClientProxy,
    @Inject('TICKET_SERVICE')  private readonly ticketClient: ClientProxy,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  private ip(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? '';
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
      .send('admin.log_action', {
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

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques de l\'audit log' })
  getStats() {
    return firstValueFrom(this.adminClient.send('admin.get_stats', {}));
  }

  // ─── Audit logs ───────────────────────────────────────────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'Journal des actions admin' })
  getLogs(
    @Query('entity_type') entity_type?: string,
    @Query('entity_id') entity_id?: string,
    @Query('performed_by') performed_by?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return firstValueFrom(
      this.adminClient.send('admin.get_logs', {
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

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspendre un compte utilisateur' })
  async suspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.userClient.send('user.suspend', { id, admin_id: user.sub, reason: dto.reason }),
    );
    this.audit(user, req, 'USER_SUSPENDED', 'USER', id, dto.reason);
    return result;
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lever la suspension d\'un compte' })
  async unsuspendUser(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const result = await firstValueFrom(
      this.userClient.send('user.unsuspend', { id, admin_id: user.sub }),
    );
    this.audit(user, req, 'USER_UNSUSPENDED', 'USER', id);
    return result;
  }

  @Post('users/:id/change-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer le rôle d\'un utilisateur' })
  async changeRole(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { role: string },
  ) {
    const result = await firstValueFrom(
      this.userClient.send('user.change_role', { id, role: dto.role, admin_id: user.sub }),
    );
    this.audit(user, req, 'USER_ROLE_CHANGED', 'USER', id, undefined, { new_role: dto.role });
    return result;
  }

  // ─── Modération des événements ────────────────────────────────────────────────

  @Get('events/pending')
  @ApiOperation({ summary: 'Événements en attente de modération' })
  getPendingEvents() {
    return firstValueFrom(this.eventClient.send('event.list_pending', {}));
  }

  @Post('events/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un événement' })
  async approveEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const result = await firstValueFrom(
      this.eventClient.send('event.approve', { id, admin_id: user.sub }),
    );
    this.audit(user, req, 'EVENT_APPROVED', 'EVENT', id);
    return result;
  }

  @Post('events/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter un événement' })
  async rejectEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send('event.reject', { id, admin_id: user.sub, reason: dto.reason }),
    );
    this.audit(user, req, 'EVENT_REJECTED', 'EVENT', id, dto.reason);
    return result;
  }

  @Post('events/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler un événement (remboursement automatique)' })
  async cancelEvent(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.eventClient.send('event.cancel', { id, admin_id: user.sub, reason: dto.reason }),
    );
    this.audit(user, req, 'EVENT_CANCELED', 'EVENT', id, dto.reason);
    return result;
  }

  // ─── Gestion des billets ──────────────────────────────────────────────────────

  @Post('tickets/:id/invalidate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalider un billet' })
  async invalidateTicket(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.ticketClient.send('ticket.invalidate', { id, admin_id: user.sub, reason: dto.reason }),
    );
    this.audit(user, req, 'TICKET_INVALIDATED', 'TICKET', id, dto.reason);
    return result;
  }

  // ─── Gestion des reversements ─────────────────────────────────────────────────

  @Post('payouts/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bloquer un reversement' })
  async blockPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send('payment.block_payout', { id, admin_id: user.sub, reason: dto.reason }),
    );
    this.audit(user, req, 'PAYOUT_BLOCKED', 'PAYOUT', id, dto.reason);
    return result;
  }

  @Post('payouts/:id/approve-early')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un reversement anticipé' })
  async approveEarlyPayout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send('payment.approve_early_payout', { id, admin_id: user.sub }),
    );
    this.audit(user, req, 'PAYOUT_EARLY_APPROVED', 'PAYOUT', id);
    return result;
  }

  // ─── Gestion des litiges ──────────────────────────────────────────────────────

  @Get('disputes')
  @ApiOperation({ summary: 'Tous les litiges' })
  getAllDisputes(@Query('order_id') order_id?: string) {
    if (order_id) {
      return firstValueFrom(
        this.paymentClient.send('payment.get_disputes_by_order', { order_id }),
      );
    }
    return firstValueFrom(this.paymentClient.send('payment.get_all_disputes', {}));
  }

  @Post('disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Résoudre un litige' })
  async resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { status: string; resolution_notes?: string },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send('payment.resolve_dispute', {
        id,
        ...dto,
        resolved_by: user.sub,
      }),
    );
    this.audit(user, req, 'DISPUTE_RESOLVED', 'DISPUTE', id, undefined, { status: dto.status });
    return result;
  }

  // ─── Remboursement forcé ──────────────────────────────────────────────────────

  @Post('orders/:orderId/force-refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forcer un remboursement (ADMIN)' })
  async forceRefund(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: { reason: string; amount_cents?: number },
  ) {
    const result = await firstValueFrom(
      this.paymentClient.send('payment.refund', { order_id: orderId, amount_cents: dto.amount_cents }),
    );
    this.audit(user, req, 'REFUND_FORCED', 'ORDER', orderId, dto.reason, {
      amount_cents: dto.amount_cents,
    });
    return result;
  }
}
