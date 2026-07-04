import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { Event, EventStatus } from './event.entity';
import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let platformConfig: { get: jest.Mock };

  const config = {
    commission_standard_percent: 10,
    commission_large_event_percent: 8,
    large_event_threshold: 1000,
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      findOne: jest.fn(),
    };
    platformConfig = { get: jest.fn().mockResolvedValue(config) };

    const module = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: repo },
        { provide: 'NOTIFICATION_SERVICE', useValue: { emit: jest.fn() } },
        { provide: 'AUTH_SERVICE', useValue: { send: jest.fn().mockReturnValue(of(null)) } },
        { provide: PlatformConfigCache, useValue: platformConfig },
      ],
    }).compile();

    service = module.get(EventService);
  });

  describe('create', () => {
    it('applique la commission standard pour une jauge sous le seuil', async () => {
      const event = await service.create('organizer-1', { total_capacity: 500 } as any);
      expect(event.commission_rate).toBe(10);
    });

    it('applique la commission dégressive au-delà du seuil de grande jauge', async () => {
      const event = await service.create('organizer-1', { total_capacity: 1500 } as any);
      expect(event.commission_rate).toBe(8);
    });
  });

  describe('validate', () => {
    it("ramène la commission à 0% si l'événement est à but non lucratif", async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: EventStatus.PENDING_VALIDATION,
        total_capacity: 500,
        is_non_profit: true,
        organizer_id: 'organizer-1',
      });

      const event = await service.validate('evt-1', 'admin-1');

      expect(event.commission_rate).toBe(0);
      expect(event.status).toBe(EventStatus.PUBLISHED);
    });

    it('conserve la commission standard/dégressive pour un événement lucratif', async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: EventStatus.PENDING_VALIDATION,
        total_capacity: 1500,
        is_non_profit: false,
        organizer_id: 'organizer-1',
      });

      const event = await service.validate('evt-1', 'admin-1');

      expect(event.commission_rate).toBe(8);
    });
  });
});
