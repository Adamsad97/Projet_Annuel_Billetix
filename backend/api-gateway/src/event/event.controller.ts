import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Order, OrderStatus } from './types/order-snapshot.type';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    @Inject('EVENT_SERVICE')    private readonly eventClient: ClientProxy,
    @Inject('ORDER_SERVICE')    private readonly orderClient: ClientProxy,
    @Inject('PAYMENT_SERVICE')  private readonly paymentClient: ClientProxy,
    @Inject('TICKET_SERVICE')   private readonly ticketClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notifClient: ClientProxy,
  ) {}

  // --- Routes publiques ---

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste des événements publiés' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'page', required: false })
  listPublished(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('page') page?: number,
  ) {
    return firstValueFrom(this.eventClient.send('event.list_published', { category, city, page }));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un événement' })
  getById(@Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.get', { id }));
  }

  @Public()
  @Get(':id/categories')
  @ApiOperation({ summary: 'Catégories de billets d\'un événement' })
  getCategories(@Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.get_categories', { event_id: id }));
  }

  // --- Routes organisateur ---

  @Post()
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Créer un événement (ORGANIZER)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create', { organizer_id: user.sub, dto }));
  }

  @Get('me/events')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Mes événements (ORGANIZER)' })
  myEvents(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(this.eventClient.send('event.list_by_organizer', { organizer_id: user.sub }));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Modifier un événement brouillon (ORGANIZER)' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.update', { id, organizer_id: user.sub, dto }));
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Soumettre un événement à la validation (ORGANIZER)' })
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.submit_for_validation', { id, organizer_id: user.sub }));
  }

  @Post(':id/categories')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Ajouter une catégorie de billet (ORGANIZER)' })
  createCategory(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create_category', { event_id: id, ...dto }));
  }

  @Post(':id/promo-codes')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Créer un code promo (ORGANIZER)' })
  createPromoCode(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(this.eventClient.send('event.create_promo_code', { event_id: id, ...dto }));
  }

  @Get(':id/promo-codes')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Lister les codes promo d\'un événement (ORGANIZER/ADMIN)' })
  listPromoCodes(@Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.get_promo_codes', { event_id: id }));
  }

  @Delete(':id/promo-codes/:codeId')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Désactiver un code promo (ORGANIZER)' })
  deactivatePromoCode(
    @CurrentUser() user: JwtPayload,
    @Param('codeId') codeId: string,
  ) {
    return firstValueFrom(
      this.eventClient.send('event.deactivate_promo_code', { id: codeId, organizer_id: user.sub }),
    );
  }

  @Public()
  @Post('validate-promo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider un code promo (public — avant commande)' })
  validatePromoCode(@Body() dto: { event_id: string; code: string }) {
    return firstValueFrom(
      this.eventClient.send('event.validate_promo_code', { event_id: dto.event_id, code: dto.code }),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Annuler un événement et rembourser tous les acheteurs (ORGANIZER/ADMIN)' })
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    const cancelledEvent = await firstValueFrom(
      this.eventClient.send('event.cancel', { id, actor_id: user.sub, dto }),
    ) as { id: string; title: string; start_date: string; venue_name: string; organizer_id: string };

    // Cascade de remboursements (fire-and-forget — ne bloque pas la réponse)
    this.refundAllOrdersForEvent(cancelledEvent, dto.reason).catch((err) =>
      this.logger.error(`Erreur cascade remboursement event ${id}: ${err?.message}`),
    );

    return cancelledEvent;
  }

  private async refundAllOrdersForEvent(
    event: { id: string; title: string; start_date: string; venue_name: string },
    cancellationReason?: string,
  ): Promise<void> {
    const orders = await firstValueFrom(
      this.orderClient.send('order.list_by_event', { event_id: event.id }),
    ) as Order[];

    const paidOrders = orders.filter(
      (order) => order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.TICKETS_SENT,
    );

    // Annulation en masse des billets (une seule requête)
    if (paidOrders.length > 0) {
      await firstValueFrom(
        this.ticketClient.send('ticket.cancel_by_event', { event_id: event.id }),
      );
    }

    // Remboursement individuel par commande
    for (const order of paidOrders) {
      try {
        await firstValueFrom(
          this.paymentClient.send('payment.refund', { order_id: order.id }),
        );
        await firstValueFrom(
          this.orderClient.send('order.mark_refunded', { id: order.id }),
        );
        this.notifClient.emit('notification.event_canceled', {
          email: order.buyer_email,
          firstName: order.buyer_first_name,
          eventName: event.title,
          eventDate: event.start_date,
          eventVenue: event.venue_name,
          refundAmount: Number(order.total_amount_ttc).toFixed(2),
          cancellationReason: cancellationReason,
        });
      } catch (refundError) {
        this.logger.error(
          `Échec remboursement commande ${order.id}: ${refundError?.message}`,
        );
      }
    }

    this.logger.log(
      `Cascade annulation event ${event.id} : ${paidOrders.length} commande(s) remboursée(s)`,
    );
  }

  // --- Routes admin ---

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Valider un événement (ADMIN)' })
  validate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return firstValueFrom(this.eventClient.send('event.validate', { id, admin_id: user.sub }));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rejeter un événement (ADMIN)' })
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(this.eventClient.send('event.reject', { id, admin_id: user.sub, dto }));
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Suspendre un événement (ADMIN)' })
  suspend(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(this.eventClient.send('event.suspend', { id, admin_id: user.sub, dto }));
  }

  @Post(':id/request-info')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Demander des informations complémentaires (ADMIN)' })
  requestInfo(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { message: string }) {
    return firstValueFrom(
      this.eventClient.send('event.request_info', { event_id: id, admin_id: user.sub, message: dto.message }),
    );
  }
}
