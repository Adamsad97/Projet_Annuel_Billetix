import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { QrDisplayCode } from './qr-display-code.entity';
import { QrSigner } from './qr-signer';
import { QrTokenHistory } from './qr-token-history.entity';
import { Ticket, TicketStatus } from './ticket.entity';
import { TicketService } from './ticket.service';

// Clé de test Ed25519 (PKCS#8 DER base64), comme QR_SIGNING_PRIVATE_KEY.
const TEST_QR_KEY = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';

describe('TicketService', () => {
  let service: TicketService;
  let signer: QrSigner;
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
        QrSigner,
        { provide: ConfigService, useValue: { getOrThrow: () => TEST_QR_KEY } },
      ],
    }).compile();

    service = module.get(TicketService);
    signer = module.get(QrSigner);
  });

  afterEach(() => jest.restoreAllMocks());

  const ticketRow = (overrides: Partial<Ticket> = {}) => ({
    id: TICKET_ID,
    event_id: EVENT_ID,
    qr_code_token: 'jeton-courant',
    status: TicketStatus.SENT,
    ...overrides,
  });

  /** Fait afficher le QR à l'instant `now` et renvoie le texte qu'il contient. */
  async function displayedQrText(now = Date.now()): Promise<string> {
    const signSpy = jest.spyOn(signer, 'sign');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await service.getDisplayQr(TICKET_ID);
    jest.spyOn(Date, 'now').mockRestore();
    const text = signSpy.mock.results[signSpy.mock.results.length - 1].value as string;
    signSpy.mockRestore();
    return text;
  }

  describe('QR signé BTX3 — vérification cryptographique', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue(ticketRow());
    });

    it('le QR est signé et ne contient ni le jeton du porteur ni donnée personnelle', async () => {
      const text = await displayedQrText();
      expect(text).toMatch(/^BTX3\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(text).not.toContain('jeton-courant');
      expect(signer.verify(text)).toMatchObject({ ticketId: TICKET_ID, eventId: EVENT_ID });
    });

    it('renvoie une image et le délai avant le code suivant (période réglée par l’admin)', async () => {
      const display = await service.getDisplayQr(TICKET_ID);
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
      const result = await service.verifyQr(await displayedQrText());
      expect(result).toMatchObject({ valid: true, ticket: { id: TICKET_ID } });
    });

    it('refuse (INVALID) un QR dont une donnée a été modifiée : la signature ne correspond plus', async () => {
      const [prefix, payload, signature] = (await displayedQrText()).split('.');
      const bytes = Buffer.from(payload, 'base64url');
      bytes.writeUInt16BE(3600, 37); // allonge la durée de validité
      await expect(service.verifyQr(`${prefix}.${bytes.toString('base64url')}.${signature}`)).rejects.toMatchObject({
        error: { code: 'INVALID' },
      });
    });

    it('refuse (INVALID) un QR signé par une autre clé', async () => {
      const foreignKey = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
      const forger = new QrSigner({ getOrThrow: () => foreignKey } as unknown as ConfigService);
      const forged = forger.sign({ ticketId: TICKET_ID, eventId: EVENT_ID, validFrom: Math.floor(Date.now() / 1000), validSeconds: 5, tokenFingerprint: '0011223344556677' });
      await expect(service.verifyQr(forged)).rejects.toMatchObject({ error: { code: 'INVALID' } });
    });

    it("accepte le code jusqu'à une période après son expiration (tolérance 1), puis EXPIRED", async () => {
      const start = 1_800_000_000_000;
      const text = await displayedQrText(start);
      await expect(service.verifyQr(text, new Date(start + 9_999))).resolves.toMatchObject({ valid: true });
      await expect(service.verifyQr(text, new Date(start + 10_000))).rejects.toMatchObject({ error: { code: 'EXPIRED' } });
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

    it('refuse (INVALID) un texte quelconque, (EXPIRED) un ancien code BTX2', async () => {
      await expect(service.verifyQr('n-importe-quoi')).rejects.toMatchObject({ error: { code: 'INVALID' } });
      displayCodes.push({ code: 'AAAAAAAAAAAAAAAAAAAAAA', ticket_id: TICKET_ID } as QrDisplayCode);
      await expect(service.verifyQr('BTX2.AAAAAAAAAAAAAAAAAAAAAA')).rejects.toMatchObject({ error: { code: 'EXPIRED' } });
    });

    it("refuse (STATIC_REFUSED) un ancien QR fixe contenant le jeton du billet", async () => {
      qrHistoryRepo.findOne.mockResolvedValue({ token: 'jeton-courant', ticket_id: TICKET_ID, is_current: true });
      await expect(service.verifyQr('jeton-courant')).rejects.toMatchObject({ error: { code: 'STATIC_REFUSED' } });
    });

    it('resolveTicketId retrouve le billet depuis le QR signé (journal des scans refusés)', async () => {
      await expect(service.resolveTicketId(await displayedQrText())).resolves.toBe(TICKET_ID);
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

    it('signale (FOR_RESALE, pas INVALID) un billet mis en revente par son titulaire', async () => {
      const text = await displayedQrText();
      repo.findOne.mockResolvedValue(ticketRow({ status: TicketStatus.FOR_RESALE }));
      await expect(service.verifyQr(text)).rejects.toMatchObject({ error: { code: 'FOR_RESALE' } });
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
      await expect(service.verifyQr(text, new Date(hourStart + 3_600_000))).rejects.toMatchObject({ error: { code: 'EXPIRED' } });
    });

    it('paquet hors ligne : clé publique, empreintes et statuts — jamais le jeton', async () => {
      (repo as unknown as { find: jest.Mock }).find = jest.fn().mockResolvedValue([ticketRow()]);
      const pack = await service.getOfflinePack(EVENT_ID);
      expect(pack).toMatchObject({ algorithm: 'Ed25519', public_key: signer.publicKeyBase64Url, rotation_seconds: 5 });
      expect(pack.tickets).toEqual([{ id: TICKET_ID, fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/), status: TicketStatus.SENT }]);
      expect(JSON.stringify(pack)).not.toContain('jeton-courant');
    });
  });

  describe('Ticket — sérialisation des réponses RPC', () => {
    it('ne transmet jamais le jeton interne hors du ticket-service', () => {
      const ticket = Object.assign(new Ticket(), ticketRow({ reference: 'TKT-1' }));
      const sent = JSON.parse(JSON.stringify(ticket));
      expect(sent).not.toHaveProperty('qr_code_token');
      expect(sent).toMatchObject({ id: TICKET_ID, reference: 'TKT-1' });
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
        event_id: EVENT_ID,
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
        event_id: EVENT_ID,
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
        [expect.any(Date), 'agent-1', 'tablette-1', 'ticket-123', null],
      );
    });

    it('lie la consommation au jeton du porteur : revendu entre vérification et scan → SUPERSEDED', async () => {
      dataSource.query.mockResolvedValue([[]]);
      repo.findOne.mockResolvedValue({ id: 'ticket-123', status: TicketStatus.SENT, qr_code_token: 'nouveau-jeton' });

      await expect(service.markUsed('ticket-123', 'agent-1', undefined, 'ancien-jeton')).rejects.toMatchObject({
        error: { code: 'SUPERSEDED' },
      });
      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('qr_code_token = $5'), [
        expect.any(Date),
        'agent-1',
        null,
        'ticket-123',
        'ancien-jeton',
      ]);
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
