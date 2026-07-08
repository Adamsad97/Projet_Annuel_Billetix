import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DiscountType, PromoCode } from './promo-code.entity';
import { PromoCodeService } from './promo-code.service';

describe('PromoCodeService', () => {
  let service: PromoCodeService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((p) => p),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    dataSource = { query: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PromoCodeService,
        { provide: getRepositoryToken(PromoCode), useValue: repo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PromoCodeService);
  });

  describe('create — propriété de l\'événement (IDOR)', () => {
    const dto = {
      event_id: 'evt-1',
      code: 'PROMO10',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 10,
      valid_from: '2026-01-01',
      valid_until: '2026-12-31',
    };

    it("refuse si l'événement n'appartient pas à l'appelant", async () => {
      dataSource.query.mockResolvedValue([{ organizer_id: 'organizer-2' }]);

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("refuse si l'événement n'existe pas", async () => {
      dataSource.query.mockResolvedValue([]);

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
    });

    it("refuse un code déjà existant pour cet événement", async () => {
      dataSource.query.mockResolvedValue([{ organizer_id: 'organizer-1' }]);
      repo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto, 'organizer-1')).rejects.toThrow(RpcException);
    });

    it("crée le code promo pour le propriétaire de l'événement", async () => {
      dataSource.query.mockResolvedValue([{ organizer_id: 'organizer-1' }]);
      repo.findOne.mockResolvedValue(null);

      const promo = await service.create(dto, 'organizer-1');

      expect(promo.code).toBe('PROMO10');
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
