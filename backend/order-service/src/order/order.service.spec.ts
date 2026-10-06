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
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let abandonedQueryBuilder: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };
  let itemRepo: { find: jest.Mock };
  let reservationService: {
    restoreItems: jest.Mock;
    retakeItems: jest.Mock;
    validate: jest.Mock;
    consume: jest.Mock;
    release: jest.Mock;
  };
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
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(abandonedQueryBuilder),
    };
    itemRepo = { find: jest.fn().mockResolvedValue([]) };
    reservationService = {
      restoreItems: jest.fn().mockResolvedValue(undefined),
      retakeItems: jest.fn().mockResolvedValue(undefined),
      validate: jest.fn(),
      consume: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue({ success: true }),
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
        status: OrderStatus.PENDING_PAYMENT,
        payment_status: PaymentStatus.PENDING,
        net_organizer_amount: 45,
      });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.net_organizer_amount).toBe(40);
      expect(reservationService.retakeItems).not.toHaveBeenCalled();
    });
  });

  describe("confirmPayment — paiement arrivé après l'abandon automatique", () => {
    const cancelled = {
      id: 'order-1',
      status: OrderStatus.CANCELLED,
      payment_status: PaymentStatus.PENDING,
      is_resale: false,
      net_organizer_amount: 45,
    };

    beforeEach(() => {
      itemRepo.find.mockResolvedValue([{ ticket_category_id: 'cat-1', quantity: 2 }]);
    });

    it('reprend le stock remis en vente puis confirme la commande', async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(reservationService.retakeItems).toHaveBeenCalledWith([{ ticket_category_id: 'cat-1', quantity: 2 }]);
      expect(result).toMatchObject({ status: OrderStatus.CONFIRMED, cancelled_at: null, cancellation_reason: null });
    });

    it("refuse (409) si les places sont reparties : aucun billet ne doit être émis", async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled });
      reservationService.retakeItems.mockRejectedValue(new RpcException({ statusCode: 409, message: 'Complet' }));

      await expect(service.confirmPayment('order-1', 'pi_123', 5)).rejects.toThrow(RpcException);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it("refuse une commande de revente annulée : l'offre a été libérée", async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled, is_resale: true });

      await expect(service.confirmPayment('order-1', 'pi_123', 5)).rejects.toThrow(RpcException);
      expect(reservationService.retakeItems).not.toHaveBeenCalled();
    });

    it("abandon simultané : rejoue sur la commande annulée et reprend le stock", async () => {
      orderRepo.findOne
        .mockResolvedValueOnce({ ...cancelled, status: OrderStatus.PENDING_PAYMENT })
        .mockResolvedValueOnce({ ...cancelled });
      // Le premier passage trouve la commande déjà annulée par le nettoyage.
      orderRepo.update.mockResolvedValueOnce({ affected: 0 }).mockResolvedValueOnce({ affected: 1 });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(reservationService.retakeItems).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it("confirmation simultanée perdue : rend le stock repris en trop", async () => {
      orderRepo.findOne
        .mockResolvedValueOnce({ ...cancelled })
        .mockResolvedValueOnce({ ...cancelled, payment_status: PaymentStatus.PAID });
      orderRepo.update.mockResolvedValueOnce({ affected: 0 });

      const result = await service.confirmPayment('order-1', 'pi_123', 5);

      expect(reservationService.restoreItems).toHaveBeenCalledWith([{ ticket_category_id: 'cat-1', quantity: 2 }]);
      expect(result.payment_status).toBe(PaymentStatus.PAID);
    });
  });

  describe("changements d'état simultanés — le stock n'est rendu qu'une fois", () => {
    it("cancel : refuse (409) sans rendre le stock si la commande vient d'être annulée ou payée", async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-1', buyer_id: 'buyer-1', status: OrderStatus.PENDING_PAYMENT });
      orderRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.cancel('order-1', 'buyer-1', false)).rejects.toThrow(RpcException);
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
    });

    it('markRefunded : un second passage simultané ne restaure pas le stock', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED, is_resale: false });
      orderRepo.update.mockResolvedValue({ affected: 0 });

      await service.markRefunded('order-1');
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
    });

    it("markTicketsSent : n'écrase pas une commande remboursée entre-temps", async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-1', status: OrderStatus.REFUNDED });

      const result = await service.markTicketsSent('order-1');

      expect(orderRepo.update).toHaveBeenCalledWith({ id: 'order-1', status: OrderStatus.CONFIRMED }, { status: OrderStatus.TICKETS_SENT });
      expect(result.status).toBe(OrderStatus.REFUNDED);
    });
  });

  describe('recordPartialRefund — billet revendu', () => {
    it('garde la commande confirmée et enregistre seulement le montant remboursé', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
        total_amount_ttc: '60.00',
        refunded_amount: '0.00',
      });

      const result = await service.recordPartialRefund('order-1', 30);

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.refunded_amount).toBe(30);
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
    });

    it('cumule les remboursements partiels successifs', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED, total_amount_ttc: '60.00', refunded_amount: '30.00' });
      await expect(service.recordPartialRefund('order-1', 30)).resolves.toMatchObject({ refunded_amount: 60 });
    });

    it('refuse de rembourser plus que le total de la commande', async () => {
      orderRepo.findOne.mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED, total_amount_ttc: '60.00', refunded_amount: '40.00' });
      await expect(service.recordPartialRefund('order-1', 30)).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 400 }) });
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('markRefunded — idempotence (défense en profondeur)', () => {
    it('ne restaure pas le stock une seconde fois si la commande est déjà remboursée', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.REFUNDED,
        is_resale: false,
      });

      const result = await service.markRefunded('order-1');

      expect(result.status).toBe(OrderStatus.REFUNDED);
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(itemRepo.find).not.toHaveBeenCalled();
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
    });

    it('rembourse normalement une commande pas encore remboursée et restaure le stock', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
        is_resale: false,
      });
      itemRepo.find.mockResolvedValue([
        { ticket_category_id: 'cat-1', quantity: 2 },
      ]);

      const result = await service.markRefunded('order-1');

      expect(result.status).toBe(OrderStatus.REFUNDED);
      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-1', quantity: 2 },
      ]);
    });
  });

  describe('markLatePaymentRefunded — trace du remboursement d\'un paiement tardif', () => {
    const cancelled = {
      id: 'order-1',
      status: OrderStatus.CANCELLED,
      payment_status: PaymentStatus.PENDING,
      payment_intent_id: null,
      total_amount_ttc: 48,
      is_resale: false,
    };

    it('passe la commande annulée en remboursée avec montant, date et paiement Stripe, sans toucher au stock', async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled });

      const result = await service.markLatePaymentRefunded('order-1', 'pi_123');

      expect(result).toMatchObject({
        status: OrderStatus.REFUNDED,
        payment_status: PaymentStatus.REFUNDED,
        payment_intent_id: 'pi_123',
        refunded_amount: 48,
      });
      expect(result.refunded_at).toBeInstanceOf(Date);
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-1', status: OrderStatus.CANCELLED }),
        expect.objectContaining({ status: OrderStatus.REFUNDED }),
      );
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
    });

    it('ne fait rien sur une commande déjà remboursée (webhook rejoué)', async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled, status: OrderStatus.REFUNDED });

      const result = await service.markLatePaymentRefunded('order-1', 'pi_123');

      expect(result.status).toBe(OrderStatus.REFUNDED);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('refuse une commande payée normalement : elle relève du remboursement classique', async () => {
      orderRepo.findOne.mockResolvedValue({ ...cancelled, status: OrderStatus.CONFIRMED, payment_status: PaymentStatus.PAID });

      await expect(service.markLatePaymentRefunded('order-1', 'pi_123')).rejects.toThrow(RpcException);
      expect(orderRepo.update).not.toHaveBeenCalled();
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
      expect(orderRepo.update).toHaveBeenCalledTimes(2);
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 'order-1', status: OrderStatus.PENDING_PAYMENT },
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-1', quantity: 2 },
      ]);
      expect(reservationService.restoreItems).toHaveBeenCalledWith([
        { ticket_category_id: 'cat-2', quantity: 1 },
      ]);
    });

    it('ignore une commande payée ou annulée entre la lecture et la bascule (stock non rendu)', async () => {
      abandonedQueryBuilder.getMany.mockResolvedValue([{ id: 'order-1', status: OrderStatus.PENDING_PAYMENT, is_resale: false }]);
      orderRepo.update.mockResolvedValue({ affected: 0 });

      expect(await service.releaseAbandoned()).toBe(0);
      expect(reservationService.restoreItems).not.toHaveBeenCalled();
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
      organizer_id?: string;
      vat_rate?: string;
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
          return of({ commission_rate: overrides.commission_rate ?? 10, organizer_id: overrides.organizer_id, vat_rate: overrides.vat_rate });
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
      dataSource.transaction.mockImplementation((transactionCallback) =>
        transactionCallback({
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

    it("refuse qu'un organisateur achète un billet pour son propre événement (libère aussitôt la réservation)", async () => {
      // organizer_id relu depuis l'événement réel, jamais depuis le DTO.
      mockEventClient({ organizer_id: 'buyer-1' });

      await expect(service.create({ ...baseDto, buyer_id: 'buyer-1' } as any)).rejects.toThrow(RpcException);

      expect(reservationService.release).toHaveBeenCalledWith('tok-1');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('applique bien un taux non-lucratif à 0% quand c\'est réellement le cas côté event-service', async () => {
      mockEventClient({ commission_rate: 0 });

      const { order } = await service.create(baseDto);

      expect(order.total_commission).toBe(0);
      expect(order.net_organizer_amount).toBe(100);
    });

    it("applique le taux de TVA de l'événement et le recopie sur la commande", async () => {
      mockEventClient({ vat_rate: '0.0550', categories: [{ id: 'cat-1', name: 'Standard', price_ht: 20 }] });

      const { order, items } = await service.create(baseDto);

      // 2 billets à 20 € HT, TVA 5,5 % : 21,10 € TTC l'unité, 42,20 € au total.
      expect(items[0]).toMatchObject({ unit_price_ttc: 21.1, total_price_ttc: 42.2 });
      expect(order).toMatchObject({ total_amount_ttc: 42.2, vat_rate: '0.0550' });
    });

    it('événement antérieur à la liste des taux : 20 %', async () => {
      mockEventClient({ categories: [{ id: 'cat-1', name: 'Standard', price_ht: 20 }] });
      const { order } = await service.create(baseDto);
      expect(order).toMatchObject({ total_amount_ttc: 48, vat_rate: '0.2000' });
    });

    it("ne facture rien à l'acheteur pour un billet gratuit — le frais fixe est déduit du net organisateur, pas ajouté au TTC", async () => {
      mockEventClient({
        commission_rate: 10,
        categories: [{ id: 'cat-1', name: 'Gratuit', price_ht: 0 }],
      });

      const { order } = await service.create(baseDto);

      // 2 billets gratuits : aucun montant TTC pour l'acheteur (tunnel
      // gratuit CDC §4.1 — aucune page de paiement ne doit être déclenchée).
      expect(order.total_amount_ht).toBe(0);
      expect(order.total_amount_ttc).toBe(0);
      expect(order.total_commission).toBe(0);
      // Frais fixe 0,50€ x 2 billets = 1€, à la charge de l'organisateur uniquement.
      expect(order.free_ticket_fees).toBe(1);
      expect(order.net_organizer_amount).toBe(-1);
    });

    it('réservation gratuite : sans adresse ni paiement, enregistrée « FREE »', async () => {
      mockEventClient({ categories: [{ id: 'cat-1', name: 'Gratuit', price_ht: 0 }] });
      const { order } = await service.create({
        ...baseDto,
        billing_address_line1: undefined,
        billing_city: undefined,
        billing_postal_code: undefined,
        billing_country: undefined,
      } as unknown as import('./dto/create-order.dto').CreateOrderDto);
      expect(order.payment_method).toBe('FREE');
      expect(order.billing_address_line1).toBeNull();
    });

    it('commande payante : adresse obligatoire et « gratuit » refusé', async () => {
      mockEventClient({ categories: [{ id: 'cat-1', name: 'Standard', price_ht: 50 }] });
      await expect(
        service.create({ ...baseDto, billing_city: '  ' } as unknown as import('./dto/create-order.dto').CreateOrderDto),
      ).rejects.toThrow(RpcException);
      await expect(
        service.create({ ...baseDto, payment_method: 'FREE' } as unknown as import('./dto/create-order.dto').CreateOrderDto),
      ).rejects.toThrow(RpcException);
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

    it('refuse plus de billets que ceux réservés (seul le stock réservé a été décompté)', async () => {
      mockEventClient();
      await expect(
        service.create({ ...baseDto, items: [{ ticket_category_id: 'cat-1', quantity: 50 }] } as any),
      ).rejects.toThrow(RpcException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("refuse une autre catégorie que celle réservée, même au même prix", async () => {
      mockEventClient({
        categories: [
          { id: 'cat-1', name: 'Standard', price_ht: 50 },
          { id: 'cat-2', name: 'VIP', price_ht: 50 },
        ],
      });
      await expect(
        service.create({ ...baseDto, items: [{ ticket_category_id: 'cat-2', quantity: 2 }] } as any),
      ).rejects.toThrow(RpcException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('accepte la réservation découpée en plusieurs lignes (un titulaire par billet)', async () => {
      mockEventClient();
      const { items } = await service.create({
        ...baseDto,
        items: [
          { ticket_category_id: 'cat-1', quantity: 1, holder_first_name: 'A', holder_last_name: 'A' },
          { ticket_category_id: 'cat-1', quantity: 1, holder_first_name: 'B', holder_last_name: 'B' },
        ],
      } as any);
      expect(items).toHaveLength(2);
    });

    it("refuse un event_id différent de celui de la réservation (infos et organisateur d'un autre événement)", async () => {
      mockEventClient();
      await expect(service.create({ ...baseDto, event_id: 'event-2' } as any)).rejects.toThrow(RpcException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("prend l'organisateur de l'événement réservé, jamais celui transmis avec la commande", async () => {
      mockEventClient({ organizer_id: 'orga-1' });
      const { order } = await service.create({ ...baseDto, organizer_id: 'orga-pirate' } as any);
      expect(order.organizer_id).toBe('orga-1');
    });

    it('génère une référence ORD-année-8 caractères, sans caractères ambigus', async () => {
      mockEventClient();
      const { order } = await service.create(baseDto);
      expect(order.reference).toMatch(new RegExp(`^ORD-${new Date().getFullYear()}-[A-HJ-NP-Z2-9]{8}$`));
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
      dataSource.transaction.mockImplementation((transactionCallback) =>
        transactionCallback({
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
      // resale_price est un prix TTC plafonné : le HT en est dérivé (60 / 1,2 = 50).
      expect(order.total_amount_ht).toBe(50);
      expect(order.total_commission).toBe(5);
      expect(order.net_organizer_amount).toBe(45);
      expect(order.is_resale).toBe(true);
      expect(order.resale_id).toBe('resale-1');
      expect(items[0].ticket_category_name).toBe('Standard');
      expect(items[0].unit_price_ht).toBe(50);
      expect(items[0].unit_price_ttc).toBe(60);
    });

    it('rejette (et libère aussitôt la réservation) si le vendeur tente de racheter son propre billet mis en revente', async () => {
      ticketClient.send.mockImplementation((pattern: string) => {
        if (pattern === 'ticket.reserve_resale') {
          return of({
            id: 'resale-1',
            status: 'RESERVED',
            resale_price: 60,
            event_id: 'event-1',
            ticket_category_id: 'cat-1',
            original_buyer_id: 'buyer-2', // même acheteur que resaleDto.buyer_id
          });
        }
        return of(undefined);
      });

      await expect(service.createFromResale(resaleDto)).rejects.toThrow(RpcException);

      expect(ticketClient.send).toHaveBeenCalledWith('ticket.release_resale_reservation', {
        resale_id: 'resale-1',
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
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
