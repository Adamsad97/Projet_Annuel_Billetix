import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { QrTokenHistory } from './qr-token-history.entity';
import { Ticket, TicketStatus } from './ticket.entity';
import { TicketService } from './ticket.service';

describe('TicketService', () => {
  let service: TicketService;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let qrHistoryRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
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
    qrHistoryRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      create: jest.fn().mockImplementation((h) => h),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { query: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: getRepositoryToken(Ticket), useValue: repo },
        { provide: getRepositoryToken(QrTokenHistory), useValue: qrHistoryRepo },
        { provide: PlatformConfigCache, useValue: { get: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(TicketService);
  });

  describe('resolveTicketId / verifyQr — jeton opaque (aucune information exploitable dans le QR)', () => {
    it("resolveTicketId retrouve l'ID du billet à partir du jeton via qr_token_history", async () => {
      qrHistoryRepo.findOne.mockResolvedValue({
        token: 'jeton-opaque-abc',
        ticket_id: 'ticket-123',
        is_current: true,
      });

      const ticketId = await service.resolveTicketId('jeton-opaque-abc');
      expect(ticketId).toBe('ticket-123');
      expect(qrHistoryRepo.findOne).toHaveBeenCalledWith({ where: { token: 'jeton-opaque-abc' } });
    });

    it('resolveTicketId rejette (code INVALID) un jeton absent de qr_token_history (jamais émis, ou totalement inventé)', async () => {
      qrHistoryRepo.findOne.mockResolvedValue(undefined);

      await expect(service.resolveTicketId('n-importe-quoi')).rejects.toMatchObject({
        error: { code: 'INVALID' },
      });
    });

    it('verifyQr rejette (code SUPERSEDED, pas INVALID) un jeton authentique dont le billet ne correspond plus (transféré depuis une revente)', async () => {
      qrHistoryRepo.findOne.mockResolvedValue({
        token: 'ancien-jeton',
        ticket_id: 'ticket-123',
        is_current: false,
      });
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: 'nouveau-jeton-apres-revente',
        status: TicketStatus.SENT,
      });

      // Distinct d'INVALID : le jeton existe bien dans l'historique (vrai
      // billet, juste périmé) — permet à l'agent de contrôle de voir
      // "billet revendu" plutôt qu'un rejet générique indistinguable d'un
      // jeton totalement inventé.
      await expect(service.verifyQr('ancien-jeton')).rejects.toMatchObject({
        error: { code: 'SUPERSEDED' },
      });
    });

    it("verifyQr rejette (code INVALID) un jeton connu de l'historique mais dont le billet n'existe pas (ou plus) en base", async () => {
      qrHistoryRepo.findOne.mockResolvedValue({
        token: 'jeton-orphelin',
        ticket_id: 'ticket-inexistant',
        is_current: true,
      });
      repo.findOne.mockResolvedValue(undefined);

      await expect(service.verifyQr('jeton-orphelin')).rejects.toMatchObject({
        error: { code: 'INVALID' },
      });
    });

    it('verifyQr accepte un jeton valide et à jour', async () => {
      qrHistoryRepo.findOne.mockResolvedValue({
        token: 'jeton-courant',
        ticket_id: 'ticket-123',
        is_current: true,
      });
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: 'jeton-courant',
        status: TicketStatus.SENT,
      });

      const result = await service.verifyQr('jeton-courant');
      expect(result.valid).toBe(true);
      expect(result.ticket.id).toBe('ticket-123');
    });

    it('verifyQr rejette (code ALREADY_USED) un billet déjà scanné', async () => {
      qrHistoryRepo.findOne.mockResolvedValue({
        token: 'jeton-courant',
        ticket_id: 'ticket-123',
        is_current: true,
      });
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: 'jeton-courant',
        status: TicketStatus.USED,
      });

      await expect(service.verifyQr('jeton-courant')).rejects.toMatchObject({
        error: { code: 'ALREADY_USED' },
      });
    });

    it('generate() produit un jeton opaque enregistré dans qr_token_history, que verifyQr accepte immédiatement (round-trip réel)', async () => {
      let savedTicket: { id: string; qr_code_token: string; status: TicketStatus } | undefined;
      let savedHistory: { token: string; ticket_id: string; is_current: boolean } | undefined;
      repo.createQueryBuilder = jest.fn(); // pas utilisé ici
      (repo as unknown as { save: jest.Mock }).save = jest.fn().mockImplementation((ticket) => {
        savedTicket = ticket;
        return Promise.resolve(ticket);
      });
      (repo as unknown as { create: jest.Mock }).create = jest.fn().mockImplementation((ticket) => ticket);
      qrHistoryRepo.save.mockImplementation((h) => {
        savedHistory = h;
        return Promise.resolve(h);
      });

      const [ticket] = await service.generate({
        order_id: 'order-1',
        buyer_id: 'buyer-1',
        buyer_email: 'jean@test.com',
        buyer_first_name: 'Jean',
        buyer_last_name: 'Dupont',
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
      // Le jeton ne doit contenir aucune structure exploitable (pas de
      // ':', pas de '.' séparant un payload d'une signature) — une valeur
      // aléatoire base64url pure.
      expect(ticket.qr_code_token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(savedHistory).toMatchObject({ token: ticket.qr_code_token, ticket_id: ticket.id, is_current: true });

      repo.findOne.mockResolvedValue(savedTicket);
      qrHistoryRepo.findOne.mockResolvedValue(savedHistory);
      const verified = await service.verifyQr(ticket.qr_code_token);
      expect(verified.valid).toBe(true);
    });

    it("retombe sur le nom de l'acheteur quand aucun titulaire n'est précisé pour le billet (bug corrigé : violait le NOT NULL holder_first_name)", async () => {
      (repo as unknown as { save: jest.Mock }).save = jest.fn().mockImplementation((ticket) =>
        Promise.resolve(ticket),
      );
      (repo as unknown as { create: jest.Mock }).create = jest.fn().mockImplementation((ticket) => ticket);

      const [ticket] = await service.generate({
        order_id: 'order-1',
        buyer_id: 'buyer-1',
        buyer_email: 'jean@test.com',
        buyer_first_name: 'Jean',
        buyer_last_name: 'Dupont',
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
          // Pas de holder_first_name/holder_last_name — cas réel du panier
          // simple (l'acheteur n'a pas nommé chaque titulaire).
        }],
      });

      expect(ticket.holder_first_name).toBe('Jean');
      expect(ticket.holder_last_name).toBe('Dupont');
    });

    it("transferToNewBuyer marque l'ancien jeton is_current=false, en enregistre un nouveau, et met à jour l'email/nom du titulaire", async () => {
      repo.findOne.mockResolvedValue({
        id: 'ticket-123',
        event_id: 'event-1',
        qr_code_token: 'ancien-jeton',
        status: TicketStatus.FOR_RESALE,
      });
      (repo as unknown as { save: jest.Mock }).save = jest.fn().mockImplementation((t) => Promise.resolve(t));

      const updated = await service.transferToNewBuyer(
        'ticket-123',
        'nouvel-acheteur',
        'order-2',
        'nouvel.acheteur@test.com',
        'Marie',
        'Martin',
      );

      expect(updated.buyer_email).toBe('nouvel.acheteur@test.com');
      expect(updated.holder_first_name).toBe('Marie');
      expect(updated.holder_last_name).toBe('Martin');
      expect(qrHistoryRepo.update).toHaveBeenCalledWith(
        { token: 'ancien-jeton' },
        { is_current: false },
      );
      expect(qrHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ticket_id: 'ticket-123', is_current: true }),
      );
      expect(updated.qr_code_token).not.toBe('ancien-jeton');
    });

    it("le QR encode le jeton en octets compressés (pas en texte lisible), et decodeQrPayload le reconstruit à l'identique", async () => {
      const token = 'jeton-opaque-de-test-1234567890';

      // Le contenu réel encodé dans l'image ne doit jamais être le texte
      // brut du jeton — sinon n'importe quel lecteur QR générique
      // (appareil photo, etc.) l'afficherait en clair.
      const qrDataUrl = await (
        service as unknown as { generateQrImage(t: string): Promise<string> }
      ).generateQrImage(token);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);

      // decodeQrPayload() est l'inverse exact : ce que l'appli de contrôle
      // lira dans le QR redonne le jeton d'origine, octet pour octet.
      const zlib = await import('zlib');
      const compressed = zlib.deflateRawSync(Buffer.from(token, 'utf8'));
      expect(service.decodeQrPayload(compressed)).toBe(token);
    });

    it('decodeQrPayload rejette (code INVALID) des octets qui ne sont pas un flux compressé valide', () => {
      expect(() => service.decodeQrPayload(Buffer.from('n-importe-quoi'))).toThrow(RpcException);
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
