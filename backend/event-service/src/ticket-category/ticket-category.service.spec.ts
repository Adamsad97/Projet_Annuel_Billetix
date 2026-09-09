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

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
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

    const module = await Test.createTestingModule({
      providers: [
        TicketCategoryService,
        { provide: getRepositoryToken(TicketCategory), useValue: repo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'AUTH_SERVICE', useValue: { send: jest.fn().mockReturnValue(of(null)) } },
        { provide: 'USER_SERVICE', useValue: userClient },
        { provide: DataSource, useValue: { query: jest.fn() } },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: TicketTierTypeService, useValue: ticketTierTypeService },
      ],
    }).compile();

    service = module.get(TicketCategoryService);
  });

  describe('create — propriété de l\'événement (IDOR)', () => {
    const dto = { event_id: 'evt-1', name: 'Standard', price_ht: 50, quota: 100 } as any;

    it("refuse si l'événement n'appartient pas à l'appelant", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-2' });

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("refuse si l'événement n'existe pas", async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
    });

    it("autorise le propriétaire de l'événement", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1' });

      const category = await service.create(dto, 'organizer-1');

      expect(category.name).toBe('Standard');
      expect(repo.save).toHaveBeenCalled();
    });

    it("vérifie que le nom fait partie de la liste gérée depuis l'espace Admin", async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1' });

      await service.create(dto, 'organizer-1');

      expect(ticketTierTypeService.assertActive).toHaveBeenCalledWith('Standard');
    });

    it('rejette un nom qui ne fait pas partie de la liste gérée depuis l\'espace Admin', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1' });
      ticketTierTypeService.assertActive.mockRejectedValue(new RpcException({ statusCode: 400, message: 'invalide' }));

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
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
});
