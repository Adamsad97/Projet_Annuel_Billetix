import { JwtService } from '@nestjs/jwt';
import { of, throwError } from 'rxjs';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway, rooms } from './realtime.gateway';

const SECRET = 'secret-de-test-suffisamment-long-pour-jwt-32';
const ORGA = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EVENT = '33333333-3333-4333-8333-333333333333';

function fakeSocket(token?: string) {
  return {
    id: 'socket-1',
    handshake: { auth: token ? { token } : {} },
    data: {} as Record<string, unknown>,
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('RealtimeGateway', () => {
  const jwt = new JwtService({ secret: SECRET });
  let eventClient: { send: jest.Mock };
  let gateway: RealtimeGateway;
  let emitted: Array<{ room: string; event: string; payload: unknown }>;

  beforeEach(() => {
    jest.useFakeTimers();
    eventClient = { send: jest.fn() };
    gateway = new RealtimeGateway(jwt, eventClient as never);
    emitted = [];
    gateway.server = {
      to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ room, event, payload }) }),
    } as never;
  });

  afterEach(() => jest.useRealTimers());

  describe('connexion', () => {
    it("refuse une connexion sans jeton ou avec un jeton invalide", async () => {
      for (const socket of [fakeSocket(), fakeSocket('pas-un-jwt'), fakeSocket(new JwtService({ secret: 'autre-secret-de-test-assez-long-1234' }).sign({ sub: ORGA }))]) {
        await gateway.handleConnection(socket as never);
        expect(socket.emit).toHaveBeenCalledWith('auth:error', { code: 'INVALID_TOKEN' });
        expect(socket.disconnect).toHaveBeenCalledWith(true);
        expect(socket.join).not.toHaveBeenCalled();
      }
    });

    it("place un acheteur dans son salon personnel, un admin aussi dans le salon des alertes", async () => {
      const buyer = fakeSocket(jwt.sign({ sub: ORGA, role: 'BUYER' }));
      await gateway.handleConnection(buyer as never);
      expect(buyer.join).toHaveBeenCalledWith(rooms.user(ORGA));
      expect(buyer.join).not.toHaveBeenCalledWith(rooms.admin);

      const admin = fakeSocket(jwt.sign({ sub: OTHER, role: 'SUPER_ADMIN' }));
      await gateway.handleConnection(admin as never);
      expect(admin.join).toHaveBeenCalledWith(rooms.admin);
    });

    it("coupe la connexion quand le jeton expire", async () => {
      const socket = fakeSocket(jwt.sign({ sub: ORGA, role: 'BUYER' }, { expiresIn: 60 }));
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).not.toHaveBeenCalled();
      jest.advanceTimersByTime(61_000);
      expect(socket.emit).toHaveBeenCalledWith('auth:error', { code: 'TOKEN_EXPIRED' });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('abonnement au tableau de bord', () => {
    async function connected(role: string, sub = ORGA) {
      const socket = fakeSocket(jwt.sign({ sub, role }));
      await gateway.handleConnection(socket as never);
      socket.join.mockClear();
      return socket;
    }

    it("accepte l'organisateur de l'événement", async () => {
      eventClient.send.mockReturnValue(of({ organizer_id: ORGA }));
      const socket = await connected('ORGANIZER');
      await expect(gateway.subscribeDashboard(socket as never, { event_id: EVENT })).resolves.toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith(rooms.event(EVENT));
    });

    it("refuse l'événement d'un autre organisateur, sans le rejoindre", async () => {
      eventClient.send.mockReturnValue(of({ organizer_id: OTHER }));
      const socket = await connected('ORGANIZER');
      await expect(gateway.subscribeDashboard(socket as never, { event_id: EVENT })).resolves.toEqual({ ok: false });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it("refuse un identifiant invalide ou un événement introuvable", async () => {
      eventClient.send.mockReturnValue(throwError(() => ({ statusCode: 404 })));
      const socket = await connected('ORGANIZER');
      await expect(gateway.subscribeDashboard(socket as never, { event_id: 'abc' })).resolves.toEqual({ ok: false });
      await expect(gateway.subscribeDashboard(socket as never, { event_id: EVENT })).resolves.toEqual({ ok: false });
    });

    it("accepte un admin sans interroger l'event-service", async () => {
      const socket = await connected('ADMIN', OTHER);
      await expect(gateway.subscribeDashboard(socket as never, { event_id: EVENT })).resolves.toEqual({ ok: true });
      expect(eventClient.send).not.toHaveBeenCalled();
    });
  });

  describe('relais des événements RabbitMQ', () => {
    it("envoie chaque événement au bon salon, sans exposer l'identifiant du titulaire", () => {
      const controller = new RealtimeController(gateway);
      controller.ticketScanned({ holder_id: ORGA, ticket_id: EVENT, event_name: 'Concert', ticket_category_name: 'VIP', scanned_at: '2026-10-02T20:00:00Z' });
      controller.dashboardChanged({ event_id: EVENT, reason: 'sale' });
      controller.adminAlert({ type: 'mass_refunds', severity: 'critical', data: { count: 12, threshold: 10 } });

      expect(emitted).toEqual([
        { room: rooms.user(ORGA), event: 'ticket:scanned', payload: { ticket_id: EVENT, event_name: 'Concert', ticket_category_name: 'VIP', scanned_at: '2026-10-02T20:00:00Z' } },
        { room: rooms.event(EVENT), event: 'dashboard:changed', payload: { event_id: EVENT, reason: 'sale' } },
        { room: rooms.admin, event: 'admin:alert', payload: { type: 'mass_refunds', severity: 'critical', data: { count: 12, threshold: 10 } } },
      ]);
    });
  });
});
