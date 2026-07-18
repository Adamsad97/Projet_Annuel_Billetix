import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { DataSource } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let abandonedQueryBuilder: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };
  let itemRepo: { find: jest.Mock };
  let reservationService: { restoreItems: jest.Mock; validate: jest.Mock; consume: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let eventClient: { send: jest.Mock };
  let ticketClient: { send: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    abandonedQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    orderRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((order) => Promise.resolve(order)),
      createQueryBuilder: jest.fn().mockReturnValue(abandonedQueryBuilder),
    };
    itemRepo = { find: jest.fn().mockResolvedValue([]) };
    reservationService = {
      restoreItems: jest.fn().mockResolvedValue(undefined),
      validate: jest.fn(),
      consume: jest.fn().mockResolvedValue(undefined),
    };
    platformConfig = {
      get: jest.fn().mockResolvedValue({
        order_abandon_timeout_minutes: 30,
        resale_reservation_minutes: 15,
      }),
    };
    eventClient = { send: jest.fn() };
    ticketClient = { send: jest.fn().mockReturnValue(of(undefined)) };
    dataSource = { transaction: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: StockReservationService, useValue: reservationService },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: 'EVENT_SERVICE', useValue: eventClient },
        { provide: 'TICKET_SERVICE', useValue: ticketClient },
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

    it('libère la réservation de revente au lieu de restaurer un quota — ne touche à aucun stock de catégorie', async () => {
      orderRepo.findOne.mockResolvedValue({ ...order, is_resale: true, resale_id: 'resale-1' });

      await service.cancel('order-1', 'buyer-1', false);

      expect(reservationService.restoreItems).not.toHaveBeenCalled();
      expect(ticketClient.send).toHaveBeenCalledWith('ticket.release_resale_reservation', {
        resale_id: 'resale-1',
      });
    });
  });

  describe('confirmPayment — idempotence (défense en profondeur)', () => {
    it('ne soustrait pas les frais une seconde fois si la commande est déjà payée', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        payment_status: PaymentStatus.PAID,
        net_organizer_amount: 45,
      });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(result.net_organizer_amount).toBe(45);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('confirme normalement une commande pas encore payée', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        payment_status: PaymentStatus.PENDING,
        net_organizer_amount: 45,
      });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.net_organizer_amount).toBe(40);
    });
  });

  describe('releaseAbandoned — libération automatique du stock', () => {
    it('annule les commandes PENDING_PAYMENT dépassant le délai configuré et restaure leur stock', async () => {
      abandonedQueryBuilder.getMany.mockResolvedValue([
        { id: 'order-1', status: OrderStatus.PENDING_PAYMENT, is_resale: false },
        { id: 'order-2', status: OrderStatus.PENDING_PAYMENT, is_resale: false },
      ]);
      itemRepo.find
        .mockResolvedValueOnce([{ ticket_category_id: 'cat-1', quantity: 2 }])
        .mockResolvedValueOnce([{ ticket_category_id: 'cat-2', quantity: 1 }]);

      const count = await service.releaseAbandoned();

      expect(count).toBe(2);
      expect(orderRepo.save).toHaveBeenCalledTimes(2);
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.CANCELLED, id: 'order-1' }),
      );
      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-1', quantity: 2 },
      ]);
      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-2', quantity: 1 },
      ]);
    });

    it("n'affecte aucune commande quand aucune n'est abandonnée", async () => {
      abandonedQueryBuilder.getMany.mockResolvedValue([]);

      const count = await service.releaseAbandoned();

      expect(count).toBe(0);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('libère la réservation de revente au lieu de restaurer un quota de catégorie', async () => {
      abandonedQueryBuilder.getMany.mockResolvedValue([
        { id: 'order-3', status: OrderStatus.PENDING_PAYMENT, is_resale: true, resale_id: 'resale-1' },
      ]);

      const count = await service.releaseAbandoned();

      expect(count).toBe(1);
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
      expect(ticketClient.send).toHaveBeenCalledWith('ticket.release_resale_reservation', {
        resale_id: 'resale-1',
      });
    });
  });

  describe('create — commission, prix et remise recalculés serveur (jamais fournis par le client)', () => {
    const baseDto = {
      buyer_id: 'buyer-1',
      event_id: 'event-1',
      reservation_token: 'tok-1',
      items: [{ ticket_category_id: 'cat-1', quantity: 2 }],
      billing_first_name: 'Jean',
      billing_last_name: 'Dupont',
      billing_email: 'jean@test.com',
      billing_address_line1: '1 rue Test',
      billing_city: 'Paris',
      billing_postal_code: '75000',
      billing_country: 'FR',
      payment_method: 'STRIPE',
    } as unknown as import('./dto/create-order.dto').CreateOrderDto;

    /** Configure eventClient.send pour répondre selon le pattern TCP appelé. */
    function mockEventClient(overrides: {
      commission_rate?: number;
      categories?: Array<{ id: string; name: string; price_ht: number }>;
      promoResult?: {
        valid: boolean;
        message?: string;
        discount_type?: 'PERCENTAGE' | 'FIXED';
        discount_value?: number;
        promo_code_id?: string;
      };
    } = {}) {
      const categories = overrides.categories ?? [
        { id: 'cat-1', name: 'Standard', price_ht: 50 },
      ];
      eventClient.send.mockImplementation((pattern: string) => {
        if (pattern === 'event.get') {
          return of({ commission_rate: overrides.commission_rate ?? 10 });
        }
        if (pattern === 'event.get_categories') return of(categories);
        if (pattern === 'event.validate_promo_code') return of(overrides.promoResult);
        return of(undefined);
      });
    }

    beforeEach(() => {
      reservationService.validate.mockResolvedValue({
        buyer_id: 'buyer-1',
        event_id: 'event-1',
        items: [{ ticket_category_id: 'cat-1', quantity: 2 }],
        expires_at: new Date().toISOString(),
      });
      platformConfig.get.mockResolvedValue({ tva_rate: 0.2, free_ticket_fee_eur: 0.5 });
      dataSource.transaction.mockImplementation((cb) =>
        cb({
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
        }),
      );
    });

    it("utilise le taux de commission de l'événement (event-service), pas celui du client", async () => {
      mockEventClient({ commission_rate: 10 });

      const { order } = await service.create({
        ...baseDto,
        // Un client malveillant tente d'imposer 0% : doit être ignoré.
        commission_rate: 0,
      } as any);

      expect(eventClient.send).toHaveBeenCalledWith('event.get', { id: 'event-1' });
      // total_ht = 50 * 2 = 100 ; commission à 10% = 10
      expect(order.total_commission).toBe(10);
      expect(order.net_organizer_amount).toBe(90);
    });

    it('applique bien un taux non-lucratif à 0% quand c\'est réellement le cas côté event-service', async () => {
      mockEventClient({ commission_rate: 0 });

      const { order } = await service.create(baseDto);

      expect(order.total_commission).toBe(0);
      expect(order.net_organizer_amount).toBe(100);
    });

    it('utilise le prix réel de la catégorie (event-service), pas celui envoyé par le client', async () => {
      mockEventClient({ categories: [{ id: 'cat-1', name: 'Standard', price_ht: 75 }] });

      const { order, items } = await service.create({
        ...baseDto,
        // Un client malveillant tente de payer 1€ au lieu de 75€ : ignoré.
        items: [{ ticket_category_id: 'cat-1', quantity: 2, unit_price_ht: 1 }],
      } as any);

      expect(eventClient.send).toHaveBeenCalledWith('event.get_categories', {
        event_id: 'event-1',
      });
      expect(items[0].unit_price_ht).toBe(75);
      expect(items[0].ticket_category_name).toBe('Standard');
      // total_ht = 75 * 2 = 150 ; commission 10% = 15
      expect(order.total_amount_ht).toBe(150);
      expect(order.total_commission).toBe(15);
    });

    it('rejette une catégorie inconnue ou inactive pour cet événement', async () => {
      mockEventClient({ categories: [] });

      await expect(service.create(baseDto)).rejects.toThrow(RpcException);
      expect(dataSource.transaction).toHaveBeenCalled(); // l'erreur est levée dans le .map() à l'intérieur
    });

    it('revalide le code promo et recalcule la remise côté serveur — ignore tout discount_amount fourni par le client', async () => {
      mockEventClient({
        promoResult: {
          valid: true,
          discount_type: 'PERCENTAGE',
          discount_value: 20,
          promo_code_id: 'promo-1',
        },
      });

      const { order } = await service.create({
        ...baseDto,
        promo_code: 'SUMMER20',
        // Un client malveillant tente d'imposer sa propre remise : ignoré.
        discount_amount: 999,
      } as any);

      expect(eventClient.send).toHaveBeenCalledWith('event.validate_promo_code', {
        event_id: 'event-1',
        code: 'SUMMER20',
      });
      // total_ht = 100, remise 20% = 20 => total_ht net = 80, commission 10% = 8
      expect(order.discount_amount).toBe(20);
      expect(order.promo_code_id).toBe('promo-1');
      expect(order.total_commission).toBe(8);
    });

    it('rejette un code promo invalide et ne crée pas la commande', async () => {
      mockEventClient({
        promoResult: { valid: false, message: 'Ce code promo est expiré.' },
      });

      await expect(
        service.create({ ...baseDto, promo_code: 'EXPIRED' } as any),
      ).rejects.toThrow(RpcException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('createFromResale — achat en revente (prix relu depuis ticket-service, pas de réservation de stock)', () => {
    const resaleDto = {
      buyer_id: 'buyer-2',
      resale_id: 'resale-1',
      billing_first_name: 'Marie',
      billing_last_name: 'Martin',
      billing_email: 'marie@test.com',
      billing_address_line1: '2 rue Test',
      billing_city: 'Lyon',
      billing_postal_code: '69000',
      billing_country: 'FR',
      payment_method: 'STRIPE',
    } as unknown as import('./dto/create-order.dto').CreateResaleOrderDto;

    beforeEach(() => {
      platformConfig.get.mockResolvedValue({ tva_rate: 0.2 });
      dataSource.transaction.mockImplementation((cb) =>
        cb({
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
        }),
      );
    });

    it("réserve puis utilise le prix de l'offre de revente (ticket-service), jamais un prix fourni par le client, et ne réserve aucun stock", async () => {
      ticketClient.send.mockReturnValue(
        of({
          id: 'resale-1',
          status: 'RESERVED',
          resale_price: 60,
          event_id: 'event-1',
          ticket_category_id: 'cat-1',
        }),
      );
      eventClient.send.mockImplementation((pattern: string) => {
        if (pattern === 'event.get') {
          return of({ commission_rate: 10, title: 'Concert Test', organizer_id: 'org-1' });
        }
        if (pattern === 'event.get_categories') {
          return of([{ id: 'cat-1', name: 'Standard' }]);
        }
        return of(undefined);
      });

      const { order, items } = await service.createFromResale(resaleDto);

      expect(ticketClient.send).toHaveBeenCalledWith('ticket.reserve_resale', {
        resale_id: 'resale-1',
        buyer_id: 'buyer-2',
      });
      expect(reservationService.validate).not.toHaveBeenCalled();
      // total_ht = 60 (prix de revente) ; commission 10% = 6
      expect(order.total_amount_ht).toBe(60);
      expect(order.total_commission).toBe(6);
      expect(order.net_organizer_amount).toBe(54);
      expect(order.is_resale).toBe(true);
      expect(order.resale_id).toBe('resale-1');
      expect(items[0].ticket_category_name).toBe('Standard');
      expect(items[0].unit_price_ht).toBe(60);
    });

    it("rejette l'achat si l'offre de revente n'est plus disponible (déjà réservée/vendue) — ticket-service refuse la réservation atomique", async () => {
      ticketClient.send.mockReturnValue(
        throwError(() => new RpcException({
          statusCode: 409,
          message: 'Cette offre de revente est déjà en cours d\'achat par quelqu\'un d\'autre ou n\'est plus disponible',
        })),
      );

      await expect(service.createFromResale(resaleDto)).rejects.toThrow();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
