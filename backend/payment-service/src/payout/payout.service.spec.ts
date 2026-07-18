import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
  let service: PayoutService;
  let repo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let queryBuilder: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };
  let stripe: { createTransfer: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      save: jest.fn().mockImplementation((payout) => Promise.resolve(payout)),
      create: jest.fn().mockImplementation((payout) => payout),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    stripe = { createTransfer: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: getRepositoryToken(Payout), useValue: repo },
        { provide: StripeService, useValue: stripe },
        {
          provide: PlatformConfigCache,
          useValue: { get: jest.fn().mockResolvedValue({ payout_delay_days: 5 }) },
        },
      ],
    }).compile();

    service = module.get(PayoutService);
  });

  describe('create', () => {
    it('calcule le montant net et programme le reversement à J+delay après la fin de l\'événement', async () => {
      const eventEnd = new Date('2026-08-01T20:00:00.000Z');

      const payout = await service.create({
        organizer_id: 'org-1',
        event_id: 'evt-1',
        gross_amount: 1000,
        commission_amount: 100,
        payment_fees_amount: 30,
        event_end_at: eventEnd.toISOString(),
      });

      expect(payout.net_amount).toBeCloseTo(870);
      const expected = new Date(eventEnd);
      expected.setDate(expected.getDate() + 5);
      expect((payout.scheduled_at as Date).toDateString()).toBe(expected.toDateString());
    });
  });

  describe('process', () => {
    it('refuse de traiter un reversement qui n\'est pas PENDING', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.COMPLETED });
      await expect(service.process('p1', 'acct_123')).rejects.toThrow(RpcException);
    });

    it('passe en COMPLETED après un virement Stripe réussi', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.PENDING, net_amount: 870, event_id: 'evt-1' });
      stripe.createTransfer.mockResolvedValue({ id: 'tr_123' });

      const result = await service.process('p1', 'acct_123');

      expect(stripe.createTransfer).toHaveBeenCalledWith({
        amount_cents: 87000,
        stripe_account_id: 'acct_123',
        order_id: 'evt-1',
      });
      expect(result.status).toBe(PayoutStatus.COMPLETED);
      expect(result.stripe_transfer_id).toBe('tr_123');
    });

    it('passe en FAILED si le virement Stripe échoue (sans jeter d\'exception)', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.PENDING, net_amount: 870, event_id: 'evt-1' });
      stripe.createTransfer.mockRejectedValue(new Error('stripe down'));

      const result = await service.process('p1', 'acct_123');

      expect(result.status).toBe(PayoutStatus.FAILED);
    });
  });

  describe('block', () => {
    it('bloque un reversement avec le motif et l\'admin', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.PENDING });
      const result = await service.block('p1', 'admin-1', 'Fraude suspectée');
      expect(result.status).toBe(PayoutStatus.BLOCKED);
      expect(result.blocked_by).toBe('admin-1');
      expect(result.blocked_reason).toBe('Fraude suspectée');
    });
  });

  describe('getDuePayouts', () => {
    it("exclut les ajustements à montant négatif ou nul (un virement Stripe ne peut jamais être négatif)", async () => {
      await service.getDuePayouts();

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('payout.net_amount > 0');
    });
  });

  describe('recalculateForRefund', () => {
    it("ne fait rien si aucun payout n'est lié à cette commande (ex: événement gratuit sans organisateur)", async () => {
      repo.findOne.mockResolvedValue(null);

      await service.recalculateForRefund('order-1', 50, 100);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('réduit directement le payout au prorata quand il est encore PENDING (pas versé)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        order_id: 'order-1',
        status: PayoutStatus.PENDING,
        gross_amount: 100,
        commission_amount: 10,
        payment_fees_amount: 3,
        net_amount: 87,
      });

      // Remboursement de 50% de la commande (50€ sur 100€ payés)
      await service.recalculateForRefund('order-1', 50, 100);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gross_amount: 50,
          commission_amount: 5,
          // frais Stripe non recalculés (non remboursés par Stripe) :
          // net = 50 - 5 - 3 = 42
          net_amount: 42,
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('réduit aussi un payout BLOCKED (pas encore versé malgré le blocage)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        order_id: 'order-1',
        status: PayoutStatus.BLOCKED,
        gross_amount: 100,
        commission_amount: 10,
        payment_fees_amount: 3,
        net_amount: 87,
      });

      await service.recalculateForRefund('order-1', 100, 100);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ gross_amount: 0, commission_amount: 0, net_amount: -3 }),
      );
    });

    it("crée un ajustement négatif séparé quand le payout est déjà COMPLETED (virement déjà émis, non modifiable)", async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        organizer_id: 'org-1',
        event_id: 'evt-1',
        order_id: 'order-1',
        status: PayoutStatus.COMPLETED,
        gross_amount: 100,
        commission_amount: 10,
        payment_fees_amount: 3,
        net_amount: 87,
      });

      await service.recalculateForRefund('order-1', 50, 100);

      // Le payout original COMPLETED n'est jamais modifié
      expect(repo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', status: PayoutStatus.COMPLETED, gross_amount: 50 }),
      );
      // Un ajustement séparé est créé à la place
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizer_id: 'org-1',
          event_id: 'evt-1',
          order_id: 'order-1',
          gross_amount: -50,
          commission_amount: -5,
          net_amount: -45,
          status: PayoutStatus.PENDING,
        }),
      );
    });

    it('crée aussi un ajustement pour un payout PROCESSING (virement en cours, non annulable)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        organizer_id: 'org-1',
        event_id: 'evt-1',
        order_id: 'order-1',
        status: PayoutStatus.PROCESSING,
        gross_amount: 100,
        commission_amount: 10,
        payment_fees_amount: 3,
        net_amount: 87,
      });

      await service.recalculateForRefund('order-1', 100, 100);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ gross_amount: -100, commission_amount: -10, net_amount: -90 }),
      );
    });
  });
});
