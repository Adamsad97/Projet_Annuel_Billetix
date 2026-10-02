import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { firstValueFrom, timeout } from 'rxjs';
import type { Server, Socket } from 'socket.io';
import { AdminAlertEvent, DashboardChangedEvent, TicketScannedEvent } from './realtime.payloads';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AccessTokenPayload {
  sub: string;
  role: string;
  exp?: number;
}

/** Salons : user:{id} (chaque compte), admin (alertes), event:{id} (tableau de bord d'un événement). */
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  event: (eventId: string) => `event:${eventId}`,
  admin: 'admin',
};

/** Connexions temps réel du site : authentifiées par le jeton d'accès, regroupées par salon. */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null;
    let payload: AccessTokenPayload;
    try {
      if (!token) throw new Error('missing');
      payload = this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      client.emit('auth:error', { code: 'INVALID_TOKEN' });
      client.disconnect(true);
      return;
    }

    client.data.userId = payload.sub;
    client.data.role = payload.role;
    await client.join(rooms.user(payload.sub));
    if (ADMIN_ROLES.includes(payload.role)) await client.join(rooms.admin);

    // Jeton expiré : on coupe, le navigateur se reconnecte avec un jeton renouvelé.
    if (payload.exp) {
      const delay = payload.exp * 1000 - Date.now();
      this.expiryTimers.set(
        client.id,
        setTimeout(() => {
          client.emit('auth:error', { code: 'TOKEN_EXPIRED' });
          client.disconnect(true);
        }, Math.max(delay, 0)),
      );
    }
  }

  handleDisconnect(client: Socket): void {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
  }

  /** Abonnement au tableau de bord d'un événement : réservé à son organisateur et aux admins. */
  @SubscribeMessage('dashboard:subscribe')
  async subscribeDashboard(@ConnectedSocket() client: Socket, @MessageBody() body: { event_id?: string }): Promise<{ ok: boolean }> {
    const eventId = body?.event_id;
    if (!eventId || !UUID.test(eventId) || !client.data.userId) return { ok: false };
    if (!ADMIN_ROLES.includes(client.data.role)) {
      const event = await firstValueFrom(
        this.eventClient.send<{ organizer_id?: string }>('event.get', { id: eventId }).pipe(timeout(5000)),
      ).catch(() => null);
      if (!event || event.organizer_id !== client.data.userId) return { ok: false };
    }
    await client.join(rooms.event(eventId));
    return { ok: true };
  }

  @SubscribeMessage('dashboard:unsubscribe')
  async unsubscribeDashboard(@ConnectedSocket() client: Socket, @MessageBody() body: { event_id?: string }): Promise<{ ok: boolean }> {
    if (body?.event_id) await client.leave(rooms.event(body.event_id));
    return { ok: true };
  }

  ticketScanned(event: TicketScannedEvent): void {
    const { holder_id, ...ticket } = event;
    this.server.to(rooms.user(holder_id)).emit('ticket:scanned', ticket);
  }

  dashboardChanged(event: DashboardChangedEvent): void {
    this.server.to(rooms.event(event.event_id)).emit('dashboard:changed', event);
  }

  adminAlert(event: AdminAlertEvent): void {
    this.server.to(rooms.admin).emit('admin:alert', event);
    this.logger.warn(`Alerte admin ${event.type} (${event.severity})`);
  }
}
