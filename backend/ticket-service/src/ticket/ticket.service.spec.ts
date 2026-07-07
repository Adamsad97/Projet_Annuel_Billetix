import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { Ticket } from './ticket.entity';
import { TicketService } from './ticket.service';

describe('TicketService', () => {
  let service: TicketService;
  let queryBuilder: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    groupBy: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: getRepositoryToken(Ticket),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PlatformConfigCache, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(TicketService);
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
