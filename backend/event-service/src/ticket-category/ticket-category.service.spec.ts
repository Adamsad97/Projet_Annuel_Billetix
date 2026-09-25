import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { Event } from '../event/event.entity';
import { TicketTierTypeService } from '../ticket-tier-type/ticket-tier-type.service';
import { TicketCategory } from './ticket-category.entity';
import { TicketCategoryService } from './ticket-category.service';

describe('TicketCategoryService', () => {
  let service: TicketCategoryService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let eventRepo: { findOne: jest.Mock; save: jest.Mock };
  let userClient: { send: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let ticketTierTypeService: { assertActive: jest.Mock };
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((category) => category),
      save: jest.fn().mockImplementation((category) => Promise.resolve(category)),
      update: jest.fn(),
    };
    eventRepo = { findOne: jest.fn(), save: jest.fn().mockImplementation((event) => Promise.resolve(event)) };
    // Par défaut : aucune préférence enregistrée -> alerte envoyée (fail-open).
    userClient = { send: jest.fn().mockReturnValue(of({})) };
    notifClient = { emit: jest.fn() };
    platformConfig = { get: jest.fn() };
    ticketTierTypeService = { assertActive: jest.fn().mockResolvedValue(undefined) };
    dataSource = { query: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketCategoryService,
        { provide: getRepositoryToken(TicketCategory), useValue: repo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'AUTH_SERVICE', useValue: { send: jest.fn().mockReturnValue(of(null)) } },
        { provide: 'USER_SERVICE', useValue: userClient },
        { provide: DataSource, useValue: dataSource },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: TicketTierTypeService, useValue: ticketTierTypeService },
      ],
    }).compile();

    service = module.get(TicketCategoryService);
  });

  describe('create — propriété de l\'événement (IDOR)', () => {
    const dto = { event_id: 'evt-1', name: 'Standard', price_ht: 50, quota: 100 } as any;

    it("refuse si l'événement n'appartient pas à l'appelant", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-2', total_capacity: 1000 });

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("refuse si l'événement n'existe pas", async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
    });

    it("autorise le propriétaire de l'événement", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });

      const category = await service.create(dto, 'organizer-1');

      expect(category.name).toBe('Standard');
      expect(repo.save).toHaveBeenCalled();
    });

    it("vérifie que le nom fait partie de la liste gérée depuis l'espace Admin", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });

      await service.create(dto, 'organizer-1');

      expect(ticketTierTypeService.assertActive).toHaveBeenCalledWith('Standard');
    });

    it('rejette une catégorie de billet déjà présente sur cet événement (même nom)', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });
      repo.findOne.mockResolvedValue({ id: 'existing-cat', event_id: 'evt-1', name: 'Standard', is_active: true });

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejette un nom qui ne fait pas partie de la liste gérée depuis l\'espace Admin', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });
      ticketTierTypeService.assertActive.mockRejectedValue(new RpcException({ statusCode: 400, message: 'invalide' }));

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('create — somme des quotas contre la capacité totale de l\'événement', () => {
    it('rejette si le quota seul dépasse la capacité totale', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 500 });
      const dto = { event_id: 'evt-1', name: 'Standard', price_ht: 50, quota: 600 } as any;

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejette si le quota ajouté aux catégories existantes dépasse la capacité totale (ex: 500 + 40 pour 500 places)', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 500 });
      repo.find.mockResolvedValue([{ id: 'cat-standard', quota: 500, is_active: true }]);
      const dto = { event_id: 'evt-1', name: 'VIP', price_ht: 50, quota: 40 } as any;

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('autorise si la somme reste exactement égale à la capacité totale', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 500 });
      repo.find.mockResolvedValue([{ id: 'cat-standard', quota: 460, is_active: true }]);
      const dto = { event_id: 'evt-1', name: 'VIP', price_ht: 50, quota: 40 } as any;

      await service.create(dto, 'organizer-1');

      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update — renommage et unicité du nom sur l\'événement', () => {
    const catId = '11111111-1111-4111-8111-111111111111';

    it('autorise à conserver son propre nom (ne se bloque pas lui-même)', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });
      repo.findOne
        .mockResolvedValueOnce({ id: catId, event_id: 'evt-1', name: 'Standard', is_active: true })
        .mockResolvedValueOnce({ id: catId, event_id: 'evt-1', name: 'Standard', is_active: true });

      await service.update(catId, { name: 'Standard' }, 'organizer-1');

      expect(repo.save).toHaveBeenCalled();
    });

    it('rejette le renommage vers un nom déjà utilisé par une autre catégorie du même événement', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 1000 });
      repo.findOne
        .mockResolvedValueOnce({ id: catId, event_id: 'evt-1', name: 'Standard', is_active: true })
        .mockResolvedValueOnce({ id: 'cat-2', event_id: 'evt-1', name: 'VIP', is_active: true });

      await expect(service.update(catId, { name: 'VIP' }, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejette une augmentation de quota qui dépasserait la capacité totale', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 500 });
      repo.findOne.mockResolvedValue({ id: catId, event_id: 'evt-1', name: 'Standard', quota: 460, is_active: true });
      // La catégorie elle-même (460) + une autre déjà existante (40) = déjà 500.
      repo.find.mockResolvedValue([
        { id: catId, quota: 460, is_active: true },
        { id: 'cat-vip', quota: 40, is_active: true },
      ]);

      await expect(service.update(catId, { quota: 500 }, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("s'auto-exclut correctement : augmenter son propre quota jusqu'à la capacité totale reste autorisé", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', total_capacity: 500 });
      repo.findOne.mockResolvedValue({ id: catId, event_id: 'evt-1', name: 'Standard', quota: 460, is_active: true });
      repo.find.mockResolvedValue([
        { id: catId, quota: 460, is_active: true },
        { id: 'cat-vip', quota: 40, is_active: true },
      ]);

      await service.update(catId, { quota: 460 }, 'organizer-1');

      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getFillStats', () => {
    it('agrège vendu/restant/taux de remplissage à travers plusieurs catégories actives', async () => {
      repo.find.mockResolvedValue([
        { id: 'c1', name: 'Standard', quota: 100, remaining_quota: 40, price_ht: 50 },
        { id: 'c2', name: 'VIP', quota: 20, remaining_quota: 0, price_ht: 150 },
      ]);

      const stats = await service.getFillStats('event-1');

      expect(stats.total_quota).toBe(120);
      expect(stats.remaining).toBe(40);
      expect(stats.sold).toBe(80);
      expect(stats.fill_rate).toBeCloseTo((80 / 120) * 100);
      expect(stats.categories).toEqual([
        { id: 'c1', name: 'Standard', quota: 100, remaining_quota: 40, sold: 60, price_ht: 50 },
        { id: 'c2', name: 'VIP', quota: 20, remaining_quota: 0, sold: 20, price_ht: 150 },
      ]);
    });

    it("retourne un taux de remplissage nul sans planter quand il n'y a aucune catégorie", async () => {
      repo.find.mockResolvedValue([]);

      const stats = await service.getFillStats('event-1');

      expect(stats.total_quota).toBe(0);
      expect(stats.fill_rate).toBe(0);
      expect(stats.categories).toEqual([]);
    });
  });

  describe('checkAndNotifyFillThresholds — alerte de remplissage (préférences niveau 2)', () => {
    const event = {
      id: 'event-1',
      title: 'Concert',
      organizer_id: 'organizer-1',
      fill_thresholds_notified: [],
    };

    beforeEach(() => {
      repo.find.mockResolvedValue([
        { id: 'c1', name: 'Standard', quota: 100, remaining_quota: 20, sold: 80, price_ht: 50 },
      ]);
      eventRepo.findOne.mockResolvedValue({ ...event });
      platformConfig.get.mockResolvedValue({ fill_thresholds: [50, 75] });
    });

    it("envoie l'alerte quand un seuil est franchi et qu'aucune préférence ne l'exclut", async () => {
      await (service as any).checkAndNotifyFillThresholds('event-1');

      expect(notifClient.emit).toHaveBeenCalled();
      expect(userClient.send).toHaveBeenCalledWith('user.get_notification_prefs', {
        user_id: 'organizer-1',
      });
    });

    it("n'envoie pas l'alerte si l'organisateur a désactivé low-stock", async () => {
      userClient.send.mockReturnValue(of({ 'low-stock': false }));

      await (service as any).checkAndNotifyFillThresholds('event-1');

      expect(notifClient.emit).not.toHaveBeenCalled();
      // Les seuils sont quand même marqués notifiés pour ne pas re-vérifier en boucle.
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fill_thresholds_notified: [50, 75] }),
      );
    });

    it('envoie par défaut (fail-open) si les préférences sont illisibles', async () => {
      userClient.send.mockReturnValue(throwError(() => new Error('user-service injoignable')));

      await (service as any).checkAndNotifyFillThresholds('event-1');

      expect(notifClient.emit).toHaveBeenCalled();
    });
  });

  // Bug corrigé : sales_start_date/sales_end_date (événement + override
  // optionnel par catégorie) étaient stockées mais jamais vérifiées à
  // l'achat — un événement validé restait achetable à n'importe quel
  // moment.
  describe('decrementQuota — fenêtre de vente', () => {
    const HOUR = 60 * 60 * 1000;
    const baseCategory = {
      id: 'cat-1',
      event_id: 'evt-1',
      name: 'Standard',
      max_per_order: 10,
      sales_start_date: null as string | null,
      sales_end_date: null as string | null,
    };

    beforeEach(() => {
      dataSource.query.mockResolvedValue([[{ id: 'cat-1', event_id: 'evt-1' }], 1]);
    });

    it("refuse si les ventes de l'événement ne sont pas encore ouvertes", async () => {
      repo.findOne.mockResolvedValue({ ...baseCategory });
      eventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        sales_start_date: new Date(Date.now() + HOUR).toISOString(),
        sales_end_date: new Date(Date.now() + 2 * HOUR).toISOString(),
      });

      await expect(service.decrementQuota('cat-1', 1)).rejects.toThrow(RpcException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it("refuse si les ventes de l'événement sont closes", async () => {
      repo.findOne.mockResolvedValue({ ...baseCategory });
      eventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        sales_start_date: new Date(Date.now() - 2 * HOUR).toISOString(),
        sales_end_date: new Date(Date.now() - HOUR).toISOString(),
      });

      await expect(service.decrementQuota('cat-1', 1)).rejects.toThrow(RpcException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('autorise pendant la fenêtre de vente de l\'événement', async () => {
      repo.findOne.mockResolvedValue({ ...baseCategory });
      eventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        sales_start_date: new Date(Date.now() - HOUR).toISOString(),
        sales_end_date: new Date(Date.now() + HOUR).toISOString(),
      });

      await expect(service.decrementQuota('cat-1', 1)).resolves.toEqual({ success: true });
      expect(dataSource.query).toHaveBeenCalled();
    });

    it("un override de la catégorie plus restrictif prime sur l'événement", async () => {
      repo.findOne.mockResolvedValue({
        ...baseCategory,
        // La catégorie n'ouvre que dans 1h alors que l'événement vend déjà.
        sales_start_date: new Date(Date.now() + HOUR).toISOString(),
      });
      eventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        sales_start_date: new Date(Date.now() - HOUR).toISOString(),
        sales_end_date: new Date(Date.now() + 2 * HOUR).toISOString(),
      });

      await expect(service.decrementQuota('cat-1', 1)).rejects.toThrow(RpcException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it("un override de la catégorie plus permissif prime aussi sur l'événement", async () => {
      repo.findOne.mockResolvedValue({
        ...baseCategory,
        // La catégorie (ex: presale VIP) ouvre déjà alors que l'événement
        // grand public n'a pas encore ouvert ses ventes.
        sales_start_date: new Date(Date.now() - HOUR).toISOString(),
      });
      eventRepo.findOne.mockResolvedValue({
        id: 'evt-1',
        sales_start_date: new Date(Date.now() + HOUR).toISOString(),
        sales_end_date: new Date(Date.now() + 2 * HOUR).toISOString(),
      });

      await expect(service.decrementQuota('cat-1', 1)).resolves.toEqual({ success: true });
    });
  });
});
