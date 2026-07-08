import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { Event } from '../event/event.entity';
import { TicketCategory } from './ticket-category.entity';
import { TicketCategoryService } from './ticket-category.service';

describe('TicketCategoryService', () => {
  let service: TicketCategoryService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let eventRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((c) => c),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      update: jest.fn(),
    };
    eventRepo = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketCategoryService,
        { provide: getRepositoryToken(TicketCategory), useValue: repo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: { emit: jest.fn() } },
        { provide: 'AUTH_SERVICE', useValue: { send: jest.fn().mockReturnValue(of(null)) } },
        { provide: DataSource, useValue: { query: jest.fn() } },
        { provide: PlatformConfigCache, useValue: { get: jest.fn() } },
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
});
