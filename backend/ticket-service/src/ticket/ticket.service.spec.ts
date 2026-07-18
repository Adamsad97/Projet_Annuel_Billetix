import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { Ticket, TicketStatus } from './ticket.entity';
import { TicketService } from './ticket.service';

const QR_SECRET = 'test-secret-do-not-use-in-prod';

describe('TicketService', () => {
  let service: TicketService;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let queryBuilder: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    groupBy: jest.Mock;
    getRawMany: jest.Mock;
  };
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
    };
    dataSource = { query: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: getRepositoryToken(Ticket), useValue: repo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(QR_SECRET) },
        },
        { provide: PlatformConfigCache, useValue: { get: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(TicketService);
  });

  describe('parseQrToken / verifyQr — sécurité du QR code (recalcul cryptographique)', () => {
    const generateToken = (ticketId: string, eventId = 'event-1') =>
      (
        service as unknown as { generateQrToken(id: string, eventId: string): string }
      ).generateQrToken(ticketId, eventId);

    it('extrait le bon ticket_id, event_id et horodatage d\'un token valide', () => {
      const token = generateToken('ticket-123', 'event-1');
      const parsed = service.parseQrToken(token);

      expect(parsed.ticketId).toBe('ticket-123');
      expect(parsed.eventId).toBe('event-1');
      expect(parsed.issuedAt).toBeCloseTo(Date.now(), -2);
    });

    it('rejette un token dont la signature a été modifiée (tentative de falsification)', () => {
      const token = generateToken('ticket-123');
      const [payload] = token.split('.');
      const tampered = `${payload}.0000000000000000000000000000000000000000000000000000000000000000`;

      expect(() => service.parseQrToken(tampered)).toThrow(RpcException);
    });

    it('rejette un token dont le payload a été modifié pour usurper un autre billet', () => {
      const token = generateToken('ticket-123');
      const [, signature] = token.split('.');
      const forgedPayload = Buffer.from('ticket-999:event-1:' + Date.now()).toString('base64url');
      const forged = `${forgedPayload}.${signature}`;

      expect(() => service.parseQrToken(forged)).toThrow(RpcException);
    });

    it('rejette un token mal formé (sans signature)', () => {
      expect(() => service.parseQrToken('n-importe-quoi')).toThrow(RpcException);
    });

    it('verifyQr rejette un token valide dont le billet ne correspond plus (transféré depuis)', async () => {
      const token = generateToken('ticket-123');
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: 'un-autre-token-plus-récent',
        status: TicketStatus.SENT,
      });

      await expect(service.verifyQr(token)).rejects.toThrow(RpcException);
    });

    it('verifyQr rejette si l\'event_id signé ne correspond plus à celui du billet en base (donnée corrompue/trafiquée)', async () => {
      const token = generateToken('ticket-123', 'event-1');
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-AUTRE',
        qr_code_token: token,
        status: TicketStatus.SENT,
      });

      await expect(service.verifyQr(token)).rejects.toMatchObject({
        error: { code: 'INVALID' },
      });
    });

    it('verifyQr accepte un token valide et à jour', async () => {
      const token = generateToken('ticket-123', 'event-1');
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: token,
        status: TicketStatus.SENT,
      });

      const result = await service.verifyQr(token);
      expect(result.valid).toBe(true);
      expect(result.ticket.id).toBe('ticket-123');
    });

    it('verifyQr rejette (code ALREADY_USED) un billet déjà scanné', async () => {
      const token = generateToken('ticket-123', 'event-1');
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: token,
        status: TicketStatus.USED,
      });

      await expect(service.verifyQr(token)).rejects.toMatchObject({
        error: { code: 'ALREADY_USED' },
      });
    });

    it('generate() produit un token que verifyQr accepte immédiatement (round-trip réel)', async () => {
      let savedTicket: { id: string; qr_code_token: string; status: TicketStatus } | undefined;
      repo.createQueryBuilder = jest.fn(); // pas utilisé ici
      (repo as unknown as { save: jest.Mock }).save = jest.fn().mockImplementation((ticket) => {
        savedTicket = ticket;
        return Promise.resolve(ticket);
      });
      (repo as unknown as { create: jest.Mock }).create = jest.fn().mockImplementation((ticket) => ticket);

      const [ticket] = await service.generate({
        order_id: 'order-1',
        buyer_id: 'buyer-1',
        buyer_email: 'jean@test.com',
        event_id: 'event-1',
        event_name: 'Concert',
        event_start_at: new Date().toISOString(),
        event_venue_name: 'Zenith',
        event_venue_address: '1 rue Test',
        event_city: 'Paris',
        artist_name: 'DJ Test',
        items: [{
          order_item_id: 'item-1',
          ticket_category_id: 'cat-1',
          ticket_category_name: 'Standard',
          unit_price_ttc: 50,
          quantity: 1,
          holder_first_name: 'Jean',
          holder_last_name: 'Dupont',
        }],
      });

      expect(ticket.qr_code_token).toBeDefined();
      const parsed = service.parseQrToken(ticket.qr_code_token);
      expect(parsed.ticketId).toBe(ticket.id);
      expect(parsed.eventId).toBe('event-1');

      repo.findOne.mockResolvedValue(savedTicket);
      const verified = await service.verifyQr(ticket.qr_code_token);
      expect(verified.valid).toBe(true);
    });
  });

  describe('markUsed — transition atomique (anti double-scan concurrent)', () => {
    it('marque le billet USED quand la transition conditionnelle affecte une ligne', async () => {
      dataSource.query.mockResolvedValue([[{ id: 'ticket-123' }]]);
      repo.findOne.mockResolvedValue({ id: 'ticket-123', status: TicketStatus.USED });

      const result = await service.markUsed('ticket-123', 'agent-1', 'tablette-1');

      expect(result.status).toBe(TicketStatus.USED);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'USED'"),
        [expect.any(Date), 'agent-1', 'tablette-1', 'ticket-123'],
      );
    });

    it('rejette (ALREADY_USED) si la transition conditionnelle n\'affecte aucune ligne — un autre scan a déjà eu lieu entre-temps', async () => {
      dataSource.query.mockResolvedValue([[]]);

      await expect(service.markUsed('ticket-123', 'agent-2')).rejects.toMatchObject({
        error: { code: 'ALREADY_USED' },
      });
    });
  });

  describe('getStatsByEvent', () => {
    it('répartit les billets par statut (utilisés/actifs/annulés/en revente)', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { status: 'USED', count: '30' },
        { status: 'SENT', count: '15' },
        { status: 'GENERATED', count: '5' },
        { status: 'CANCELLED', count: '2' },
        { status: 'FOR_RESALE', count: '3' },
      ]);

      const stats = await service.getStatsByEvent('event-1');

      expect(stats).toEqual({
        total: 55,
        used: 30,
        active: 20,
        cancelled: 2,
        for_resale: 3,
      });
    });

    it('ne plante pas quand aucun billet n\'existe pour cet événement', async () => {
      queryBuilder.getRawMany.mockResolvedValue([]);

      const stats = await service.getStatsByEvent('event-vide');

      expect(stats).toEqual({ total: 0, used: 0, active: 0, cancelled: 0, for_resale: 0 });
    });
  });
});
