import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: { findOne: jest.Mock; save: jest.Mock };
  let itemRepo: { find: jest.Mock };
  let reservationService: { restoreItems: jest.Mock };

  beforeEach(async () => {
    orderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((o) => Promise.resolve(o)),
    };
    itemRepo = { find: jest.fn().mockResolvedValue([]) };
    reservationService = { restoreItems: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
        { provide: DataSource, useValue: {} },
        { provide: StockReservationService, useValue: reservationService },
        { provide: PlatformConfigCache, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrderService);
  });

  describe('cancel — droit d\'annulation', () => {
    const order = {
      id: 'order-1',
      buyer_id: 'buyer-1',
      status: OrderStatus.PENDING_PAYMENT,
    };

    it("refuse si l'appelant n'est ni le propriétaire ni un admin", async () => {
      orderRepo.findOne.mockResolvedValue({ ...order });

      await expect(service.cancel('order-1', 'un-autre-acheteur', false)).rejects.toThrow(RpcException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('autorise le propriétaire de la commande', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order });

      const result = await service.cancel('order-1', 'buyer-1', false);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('autorise un admin sur la commande de quelqu\'un d\'autre', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order });

      const result = await service.cancel('order-1', 'admin-1', true);

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('refuse d\'annuler une commande déjà payée — doit passer par le remboursement', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order, status: OrderStatus.CONFIRMED });

      await expect(service.cancel('order-1', 'buyer-1', false)).rejects.toThrow(RpcException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('refuse d\'annuler une commande déjà annulée ou remboursée', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order, status: OrderStatus.CANCELLED });

      await expect(service.cancel('order-1', 'buyer-1', false)).rejects.toThrow(RpcException);
    });

    it('restitue le quota de chaque catégorie de billets de la commande', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order });
      itemRepo.find.mockResolvedValue([
        { ticket_category_id: 'cat-1', quantity: 2 },
        { ticket_category_id: 'cat-2', quantity: 1 },
      ]);

      await service.cancel('order-1', 'buyer-1', false);

      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-1', quantity: 2 },
        { ticket_category_id: 'cat-2', quantity: 1 },
      ]);
    });
  });
});
