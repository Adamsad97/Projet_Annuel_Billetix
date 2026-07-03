import {
  Body,
  Controller,
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
  ) {}

  @Post()
  @ApiOperation({ summary: 'Passer une commande' })
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
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
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

  // Routes organisateur
  @Get('event/:eventId')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Commandes d\'un événement (ORGANIZER/ADMIN)' })
  listByEvent(@Param('eventId') eventId: string) {
    return firstValueFrom(
      this.orderClient.send('order.list_by_event', { event_id: eventId }),
    );
  }
}
