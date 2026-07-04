import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { RedisService } from '../redis/redis.service';
import { StockReservationService } from './stock-reservation.service';

describe('StockReservationService', () => {
  let service: StockReservationService;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let eventClient: { send: jest.Mock };

  beforeEach(async () => {
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    eventClient = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        StockReservationService,
        { provide: RedisService, useValue: redis },
        { provide: 'EVENT_SERVICE', useValue: eventClient },
        {
          provide: PlatformConfigCache,
          useValue: { get: jest.fn().mockResolvedValue({ stock_reservation_ttl_seconds: 600 }) },
        },
      ],
    }).compile();

    service = module.get(StockReservationService);
  });

  describe('reserve', () => {
    it('décrémente chaque catégorie et pose une clé Redis avec le TTL configuré', async () => {
      eventClient.send.mockReturnValue(of({ success: true }));

      const result = await service.reserve('buyer-1', 'event-1', [
        { ticket_category_id: 'cat-1', quantity: 2 },
      ]);

      expect(eventClient.send).toHaveBeenCalledWith('event.decrement_quota', {
        id: 'cat-1',
        quantity: 2,
      });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('reservation:'),
        expect.any(String),
        600,
      );
      expect(result).toHaveProperty('reservation_token');
      expect(result.expires_at).toBeInstanceOf(Date);
    });

    it("annule (rollback) les décrémentations déjà faites si une catégorie suivante échoue (anti-survente)", async () => {
      eventClient.send
        .mockReturnValueOnce(of({ success: true })) // cat-1 : ok
        .mockReturnValueOnce(throwError(() => ({ error: { message: 'Places insuffisantes' } }))) // cat-2 : échec
        .mockReturnValueOnce(of({ success: true })); // rollback de cat-1

      await expect(
        service.reserve('buyer-1', 'event-1', [
          { ticket_category_id: 'cat-1', quantity: 2 },
          { ticket_category_id: 'cat-2', quantity: 100 },
        ]),
      ).rejects.toThrow(RpcException);

      // Le rollback doit restaurer uniquement la catégorie déjà décrémentée (cat-1)
      expect(eventClient.send).toHaveBeenCalledWith('event.restore_quota', {
        id: 'cat-1',
        quantity: 2,
      });
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('rejette un token expiré ou inconnu', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.validate('token-x', 'buyer-1')).rejects.toThrow(RpcException);
    });

    it("rejette un token appartenant à un autre acheteur", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ buyer_id: 'autre-acheteur', event_id: 'e1', items: [], expires_at: '' }),
      );
      await expect(service.validate('token-x', 'buyer-1')).rejects.toThrow(RpcException);
    });

    it('retourne les données de réservation pour le bon acheteur', async () => {
      const data = { buyer_id: 'buyer-1', event_id: 'e1', items: [], expires_at: '2030-01-01' };
      redis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.validate('token-x', 'buyer-1');
      expect(result).toEqual(data);
    });
  });

  describe('release', () => {
    it('restaure le stock et supprime la réservation', async () => {
      const data = {
        buyer_id: 'buyer-1',
        event_id: 'e1',
        items: [{ ticket_category_id: 'cat-1', quantity: 2 }],
        expires_at: '2030-01-01',
      };
      redis.get.mockResolvedValue(JSON.stringify(data));
      eventClient.send.mockReturnValue(of({ success: true }));

      await service.release('token-x');

      expect(eventClient.send).toHaveBeenCalledWith('event.restore_quota', {
        id: 'cat-1',
        quantity: 2,
      });
      expect(redis.del).toHaveBeenCalledWith('reservation:token-x');
    });

    it('ne fait rien si le token est déjà expiré', async () => {
      redis.get.mockResolvedValue(null);
      await service.release('token-x');
      expect(eventClient.send).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
