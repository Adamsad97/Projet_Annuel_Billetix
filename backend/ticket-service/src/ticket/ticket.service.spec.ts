import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { QrDisplayCode } from './qr-display-code.entity';
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
  let platformConfig: { get: jest.Mock };
  // Table qr_display_codes simulée en mémoire.
  let displayCodes: QrDisplayCode[];
  let displayCodeRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

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
    platformConfig = {
      get: jest.fn().mockResolvedValue({
        ticket_qr_rotation_seconds: 5,
        ticket_qr_rotation_tolerance_steps: 1,
      }),
    };
    displayCodes = [];
    displayCodeRepo = {
      findOne: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          displayCodes.find((row) =>
            Object.entries(where).every(([key, value]) => {
              const current = row[key as keyof QrDisplayCode];
              return value instanceof Date
                ? current instanceof Date && current.getTime() === value.getTime()
                : current === value;
            }),
          ) ?? null,
        ),
      ),
      create: jest.fn((row: QrDisplayCode) => row),
      save: jest.fn((row: QrDisplayCode) => {
        displayCodes.push(row);
        return Promise.resolve(row);
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: getRepositoryToken(Ticket), useValue: repo },
        { provide: getRepositoryToken(QrTokenHistory), useValue: qrHistoryRepo },
        { provide: getRepositoryToken(QrDisplayCode), useValue: displayCodeRepo },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(TicketService);
  });

  afterEach(() => jest.restoreAllMocks());

  const ticketRow = (overrides: Partial<Ticket> = {}) => ({
    id: 'ticket-123',
    event_id: 'event-1',
    qr_code_token: 'jeton-courant',
    status: TicketStatus.SENT,
    ...overrides,
  });

  /** Fait afficher le QR à l'instant `now` et renvoie le texte qu'il contient. */
  async function displayedQrText(now = Date.now()): Promise<string> {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await service.getDisplayQr('ticket-123');
    jest.spyOn(Date, 'now').mockRestore();
    return `BTX2.${displayCodes[displayCodes.length - 1].code}`;
  }

  describe('QR éphémère BTX2 — aucune donnée du billet dans le QR', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue(ticketRow());
    });

    it('le QR ne contient que BTX2 + un code aléatoire de 128 bits — ni jeton, ni identifiant', async () => {
      const text = await displayedQrText();
      expect(text).toMatch(/^BTX2\.[A-Za-z0-9_-]{22}$/);
      expect(text).not.toContain('jeton-courant');
      expect(text).not.toContain('ticket-123');
      expect(displayCodes[0]).toMatchObject({ ticket_id: 'ticket-123', ticket_token: 'jeton-courant' });
    });

    it('renvoie une image et le délai avant le code suivant (période réglée par l’admin)', async () => {
      const display = await service.getDisplayQr('ticket-123');
      expect(display.qr_code_url).toMatch(/^data:image\/png;base64,/);
      expect(display.refresh_in_seconds).toBeGreaterThan(0);
      expect(display.refresh_in_seconds).toBeLessThanOrEqual(5);
    });

    it('même code pendant la période, nouveau code à la suivante', async () => {
      const start = 1_800_000_000_000; // multiple de 5 s
      const first = await displayedQrText(start + 1_000);
      const again = await displayedQrText(start + 4_000);
      const next = await displayedQrText(start + 5_000);
      expect(again).toBe(first);
      expect(next).not.toBe(first);
    });

    it('accepte le code de la période en cours', async () => {
      const text = await displayedQrText();
      const result = await service.verifyQr(text);
      expect(result).toMatchObject({ valid: true, ticket: { id: 'ticket-123' } });
    });

    it("accepte le code jusqu'à une période après son expiration (tolérance 1), puis EXPIRED", async () => {
      const start = 1_800_000_000_000;
      const text = await displayedQrText(start);
      await expect(service.verifyQr(text, new Date(start + 9_999))).resolves.toMatchObject({ valid: true });
      await expect(service.verifyQr(text, new Date(start + 10_000))).rejects.toMatchObject({
        error: { code: 'EXPIRED' },
      });
    });

    it("refuse (EXPIRED) une capture d'écran ancienne", async () => {
      const text = await displayedQrText(Date.now() - 5 * 60_000);
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'EXPIRED' } });
    });

    it("juge un scan hors ligne à l'heure du scan, pas à celle de la synchronisation", async () => {
      const scannedAt = Date.now() - 2 * 3600_000;
      const text = await displayedQrText(scannedAt);
      await expect(service.verifyQr(text, new Date(scannedAt))).resolves.toMatchObject({ valid: true });
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'EXPIRED' } });
    });

    it('refuse (INVALID) un code inventé ou un texte quelconque', async () => {
      await expect(service.verifyQr('BTX2.AAAAAAAAAAAAAAAAAAAAAA')).rejects.toMatchObject({
        error: { code: 'INVALID' },
      });
      await expect(service.verifyQr('n-importe-quoi')).rejects.toMatchObject({ error: { code: 'INVALID' } });
    });

    it("refuse (STATIC_REFUSED) un ancien QR fixe contenant le jeton du billet", async () => {
      qrHistoryRepo.findOne.mockResolvedValue({ token: 'jeton-courant', ticket_id: 'ticket-123', is_current: true });
      await expect(service.verifyQr('jeton-courant')).rejects.toMatchObject({ error: { code: 'STATIC_REFUSED' } });
    });

    it('resolveTicketId retrouve le billet depuis le code affiché (journal des scans refusés)', async () => {
      const text = await displayedQrText();
      await expect(service.resolveTicketId(text)).resolves.toBe('ticket-123');
    });

    it('refuse (SUPERSEDED) un code affiché avant la revente du billet', async () => {
      const text = await displayedQrText();
      repo.findOne.mockResolvedValue(ticketRow({ qr_code_token: 'nouveau-jeton-apres-revente' }));
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'SUPERSEDED' } });
    });

    it('après une revente, le nouveau porteur obtient un nouveau code dans la même période', async () => {
      const now = 1_800_000_000_000;
      const before = await displayedQrText(now);
      repo.findOne.mockResolvedValue(ticketRow({ qr_code_token: 'nouveau-jeton-apres-revente' }));
      const after = await displayedQrText(now + 1_000);
      expect(after).not.toBe(before);
      await expect(service.verifyQr(after, new Date(now + 1_000))).resolves.toMatchObject({ valid: true });
    });

    it('refuse (ALREADY_USED) un billet déjà scanné', async () => {
      const text = await displayedQrText();
      repo.findOne.mockResolvedValue(ticketRow({ status: TicketStatus.USED }));
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'ALREADY_USED' } });
    });

    it("refuse (INVALID) un code dont le billet n'existe plus", async () => {
      const text = await displayedQrText();
      repo.findOne.mockResolvedValue(undefined);
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'INVALID' } });
    });

    it('suit la période configurée (jamais une valeur figée)', async () => {
      platformConfig.get.mockResolvedValue({ ticket_qr_rotation_seconds: 3600, ticket_qr_rotation_tolerance_steps: 0 });
      const hourStart = 1_800_000_000_000 - (1_800_000_000_000 % 3_600_000);
      const text = await displayedQrText(hourStart + 60_000);
      await expect(service.verifyQr(text, new Date(hourStart + 3_000_000))).resolves.toMatchObject({ valid: true });
      await expect(service.verifyQr(text, new Date(hourStart + 3_600_000))).rejects.toMatchObject({
        error: { code: 'EXPIRED' },
      });
    });
  });

  describe('Ticket — sérialisation des réponses RPC', () => {
    it('ne transmet jamais le jeton interne hors du ticket-service', () => {
      const ticket = Object.assign(new Ticket(), ticketRow({ reference: 'TKT-1' }));
      const sent = JSON.parse(JSON.stringify(ticket));
      expect(sent).not.toHaveProperty('qr_code_token');
      expect(sent).toMatchObject({ id: 'ticket-123', reference: 'TKT-1' });
    });
  });

  describe('generate / transferToNewBuyer', () => {
    it('generate() produit un jeton interne opaque, et le code affiché pour ce billet passe au contrôle (round-trip réel)', async () => {
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

      // Le jeton reste interne : c'est le code affiché qui passe au contrôle.
      repo.findOne.mockResolvedValue(savedTicket);
      const verified = await service.verifyQr(await displayedQrText());
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
