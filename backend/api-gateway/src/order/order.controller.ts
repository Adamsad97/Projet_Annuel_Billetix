import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
  ) {}

  /**
   * Étape 1 du tunnel d'achat — réserve le stock atomiquement dans Redis (TTL 10 min).
   * Retourne un reservation_token à passer dans POST /orders.
   */
  @Post('reserve')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Réserver le stock (étape 1 — TTL 10 min)' })
  reserve(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      event_id: string;
      items: { ticket_category_id: string; quantity: number }[];
    },
  ) {
    return firstValueFrom(
      this.orderClient.send('order.reserve_stock', {
        buyer_id: user.sub,
        event_id: dto.event_id,
        items: dto.items,
      }),
    );
  }

  /**
   * Abandon panier — libère le stock réservé.
   */
  @Delete('reserve/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Libérer une réservation (abandon panier)' })
  releaseReservation(@Param('token') token: string) {
    return firstValueFrom(
      this.orderClient.send('order.release_reservation', { reservation_token: token }),
    );
  }

  /**
   * Étape 2 — crée la commande en DB (valide le reservation_token).
   */
  @Post()
  @ApiOperation({ summary: 'Passer une commande (étape 2 — après réservation stock)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return firstValueFrom(
      this.orderClient.send('order.create', { ...dto, buyer_id: user.sub }),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Mes commandes' })
  myOrders(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.orderClient.send('order.list_by_buyer', { buyer_id: user.sub }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une commande' })
  getById(@Param('id') id: string) {
    return firstValueFrom(this.orderClient.send('order.get', { id }));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler une commande' })
  cancel(@Param('id') id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(
      this.orderClient.send('order.cancel', { id, reason: dto.reason }),
    );
  }

  @Get('event/:eventId')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Commandes d\'un événement (ORGANIZER/ADMIN)' })
  listByEvent(@Param('eventId') eventId: string) {
    return firstValueFrom(
      this.orderClient.send('order.list_by_event', { event_id: eventId }),
    );
  }
}
