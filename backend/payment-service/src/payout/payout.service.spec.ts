import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StripeService } from '../stripe/stripe.service';
import { Payout, PayoutStatus } from './payout.entity';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
  let service: PayoutService;
  let repo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let stripe: { createTransfer: jest.Mock };

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      create: jest.fn().mockImplementation((p) => p),
      findOne: jest.fn(),
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
});
