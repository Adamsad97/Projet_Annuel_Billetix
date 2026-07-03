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

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketController {
  constructor(
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientProxy,
  ) {}

  // --- Acheteur ---

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Billets d\'une commande' })
  getByOrder(@Param('orderId') orderId: string) {
    return firstValueFrom(this.ticketClient.send('ticket.get_by_order', { order_id: orderId }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un billet' })
  getById(@Param('id') id: string) {
    return firstValueFrom(this.ticketClient.send('ticket.get', { id }));
  }

  // --- Agent de contrôle : scan ---

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Roles('AGENT', 'ORGANIZER')
  @ApiOperation({ summary: 'Scanner un QR code (AGENT/ORGANIZER)' })
  scan(@CurrentUser() user: JwtPayload, @Body() dto: { qr_token: string; event_id: string; device_info?: string }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.scan', { ...dto, agent_id: user.sub }),
    );
  }

  @Post('sync-offline')
  @HttpCode(HttpStatus.OK)
  @Roles('AGENT', 'ORGANIZER')
  @ApiOperation({ summary: 'Synchroniser les scans hors-ligne (AGENT/ORGANIZER)' })
  syncOffline(@CurrentUser() user: JwtPayload, @Body() dto: { event_id: string; entries: unknown[] }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.sync_offline', { agent_id: user.sub, ...dto }),
    );
  }

  @Get('event/:eventId/scan-logs')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Logs de scan d\'un événement (ORGANIZER/ADMIN)' })
  getScanLogs(@Param('eventId') eventId: string) {
    return firstValueFrom(this.ticketClient.send('ticket.get_scan_logs', { event_id: eventId }));
  }

  // --- Organisateur : gestion des agents ---

  @Post('event/:eventId/agents')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Assigner un agent à l\'événement (ORGANIZER)' })
  assignAgent(@CurrentUser() user: JwtPayload, @Param('eventId') eventId: string, @Body() dto: { user_id: string; is_supervisor?: boolean }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.assign_agent', { ...dto, event_id: eventId, assigned_by: user.sub }),
    );
  }

  @Get('event/:eventId/agents')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiOperation({ summary: 'Liste des agents d\'un événement (ORGANIZER/ADMIN)' })
  getAgents(@Param('eventId') eventId: string) {
    return firstValueFrom(this.ticketClient.send('ticket.get_agents', { event_id: eventId }));
  }

  // --- Agent : session mobile ---

  @Post('session/start')
  @HttpCode(HttpStatus.OK)
  @Roles('AGENT', 'ORGANIZER')
  @ApiOperation({ summary: 'Démarrer une session de scan mobile' })
  startSession(@CurrentUser() user: JwtPayload, @Body() dto: { event_id: string }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.start_session', { user_id: user.sub, event_id: dto.event_id }),
    );
  }

  @Post('session/end')
  @HttpCode(HttpStatus.OK)
  @Roles('AGENT', 'ORGANIZER')
  @ApiOperation({ summary: 'Terminer la session de scan' })
  endSession(@CurrentUser() user: JwtPayload, @Body() dto: { event_id: string }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.end_session', { user_id: user.sub, event_id: dto.event_id }),
    );
  }

  // --- Admin ---

  @Post(':id/invalidate')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Invalider un billet (ADMIN)' })
  invalidate(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: { reason: string }) {
    return firstValueFrom(
      this.ticketClient.send('ticket.invalidate', { id, admin_id: user.sub, reason: dto.reason }),
    );
  }
}
