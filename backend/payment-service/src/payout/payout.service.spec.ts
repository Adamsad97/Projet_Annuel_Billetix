import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
  let service: PayoutService;
  let repo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
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
      find: jest.fn(),
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
          useValue: {
            get: jest.fn().mockResolvedValue({
              payout_delay_days: 5,
              payout_early_request_min_days_after_event: 2,
            }),
          },
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
      expect(payout.event_end_at).toEqual(eventEnd);
    });
  });

  describe('requestEarly', () => {
    it("refuse si l'appelant n'est pas l'organisateur du reversement", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', organizer_id: 'org-1', status: PayoutStatus.PENDING });
      await expect(service.requestEarly('p1', 'org-2')).rejects.toThrow(RpcException);
    });

    it("refuse si le reversement n'est pas PENDING (déjà bloqué/versé)", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', organizer_id: 'org-1', status: PayoutStatus.BLOCKED });
      await expect(service.requestEarly('p1', 'org-1')).rejects.toThrow(RpcException);
    });

    it("refuse si moins de J+2 se sont écoulés depuis la fin de l'événement (CDC §7.2)", async () => {
      const eventEndedYesterday = new Date();
      eventEndedYesterday.setDate(eventEndedYesterday.getDate() - 1);
      repo.findOne.mockResolvedValue({
        id: 'p1',
        organizer_id: 'org-1',
        status: PayoutStatus.PENDING,
        event_end_at: eventEndedYesterday,
      });

      await expect(service.requestEarly('p1', 'org-1')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('accepte la demande une fois le délai J+2 dépassé', async () => {
      const eventEndedFourDaysAgo = new Date();
      eventEndedFourDaysAgo.setDate(eventEndedFourDaysAgo.getDate() - 4);
      repo.findOne.mockResolvedValue({
        id: 'p1',
        organizer_id: 'org-1',
        status: PayoutStatus.PENDING,
        event_end_at: eventEndedFourDaysAgo,
      });

      const result = await service.requestEarly('p1', 'org-1');

      expect(result.requested_early_at).toBeInstanceOf(Date);
    });
  });

  describe('approveEarly', () => {
    it("refuse d'approuver s'il n'existe aucune demande anticipée", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', requested_early_at: null });
      await expect(service.approveEarly('p1', 'admin-1')).rejects.toThrow(RpcException);
    });

    it('approuve et avance la date de reversement à maintenant', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', requested_early_at: new Date('2026-08-05') });

      const result = await service.approveEarly('p1', 'admin-1');

      expect(result.early_request_approved_by).toBe('admin-1');
      expect(result.scheduled_at).toBeInstanceOf(Date);
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

  describe('blockByOrder', () => {
    it("bloque automatiquement (sans admin) le reversement PENDING lié à la commande d'un litige", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', order_id: 'order-1', status: PayoutStatus.PENDING });

      const result = await service.blockByOrder('order-1', 'Litige ouvert (#d1)');

      expect(result?.status).toBe(PayoutStatus.BLOCKED);
      expect(result?.blocked_by).toBeNull();
      expect(result?.blocked_reason).toBe('Litige ouvert (#d1)');
    });

    it("ne fait rien si aucun reversement n'est lié à la commande", async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.blockByOrder('order-1', 'Litige ouvert (#d1)');
      expect(result).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("ne bloque pas un reversement déjà versé (COMPLETED) — un virement Stripe émis ne peut pas être rappelé", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', order_id: 'order-1', status: PayoutStatus.COMPLETED });
      const result = await service.blockByOrder('order-1', 'Litige ouvert (#d1)');
      expect(result).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('unblock', () => {
    it('repasse un reversement BLOCKED en PENDING', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.BLOCKED });
      const result = await service.unblock('p1');
      expect(result.status).toBe(PayoutStatus.PENDING);
    });

    it("refuse de débloquer un reversement qui n'est pas bloqué", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', status: PayoutStatus.PENDING });
      await expect(service.unblock('p1')).rejects.toThrow(RpcException);
    });
  });

  describe('unblockByOrder', () => {
    it('débloque le reversement lié à la commande (litige résolu)', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', order_id: 'order-1', status: PayoutStatus.BLOCKED });
      await service.unblockByOrder('order-1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PayoutStatus.PENDING }));
    });

    it("ne fait rien si le reversement n'est pas bloqué (déjà débloqué ou jamais bloqué)", async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', order_id: 'order-1', status: PayoutStatus.PENDING });
      await service.unblockByOrder('order-1');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('getExpiredBlockedPayouts', () => {
    it('interroge les reversements BLOCKED depuis plus de maxDays jours', async () => {
      repo.find.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.getExpiredBlockedPayouts(30);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: PayoutStatus.BLOCKED }) }),
      );
      expect(result).toEqual([{ id: 'p1' }]);
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
