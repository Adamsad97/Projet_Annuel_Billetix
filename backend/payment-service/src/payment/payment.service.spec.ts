import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutService } from '../payout/payout.service';
import { StripeService } from '../stripe/stripe.service';
import { Payment, PaymentStatus } from './payment.entity';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let stripe: { createRefund: jest.Mock };
  let payoutService: { recalculateForRefund: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      create: jest.fn().mockImplementation((p) => p),
    };
    stripe = { createRefund: jest.fn().mockResolvedValue({}) };
    payoutService = { recalculateForRefund: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: repo },
        { provide: StripeService, useValue: stripe },
        { provide: PayoutService, useValue: payoutService },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  describe('refund — remboursement total et partiel', () => {
    const paidPayment = {
      id: 'pay-1',
      order_id: 'order-1',
      amount: 100,
      provider_payment_id: 'pi_123',
      status: PaymentStatus.PAID,
      refunded_amount: null,
    };

    it('rejette un remboursement sur un paiement non payé', async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment, status: PaymentStatus.PENDING });

      await expect(service.refund('order-1')).rejects.toThrow(RpcException);
      expect(stripe.createRefund).not.toHaveBeenCalled();
    });

    it('rejette un montant de remboursement supérieur au solde restant', async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment });

      await expect(service.refund('order-1', 15000)).rejects.toThrow(RpcException);
      expect(stripe.createRefund).not.toHaveBeenCalled();
    });

    it('un remboursement partiel passe le statut à PARTIALLY_REFUNDED (pas REFUNDED)', async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment });

      const result = await service.refund('order-1', 3000); // 30€ sur 100€

      expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(result.refunded_amount).toBe(30);
    });

    it('déclenche le recalcul du payout avec le montant réellement remboursé', async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment });

      await service.refund('order-1', 3000);

      expect(payoutService.recalculateForRefund).toHaveBeenCalledWith('order-1', 30, 100);
    });

    it('un remboursement total (sans montant précisé) passe le statut à REFUNDED', async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment });

      const result = await service.refund('order-1');

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(result.refunded_amount).toBe(100);
    });

    it('cumule un second remboursement partiel après un premier (déjà PARTIALLY_REFUNDED)', async () => {
      repo.findOne.mockResolvedValue({
        ...paidPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunded_amount: 30,
      });

      const result = await service.refund('order-1', 2000); // 20€ de plus

      expect(result.refunded_amount).toBe(50);
      expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    });

    it('passe à REFUNDED quand un second remboursement partiel épuise le solde restant', async () => {
      repo.findOne.mockResolvedValue({
        ...paidPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunded_amount: 30,
      });

      const result = await service.refund('order-1', 7000); // les 70€ restants

      expect(result.refunded_amount).toBe(100);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it("n'échoue pas si le recalcul du payout lève une erreur (ne doit jamais bloquer le remboursement)", async () => {
      repo.findOne.mockResolvedValue({ ...paidPayment });
      payoutService.recalculateForRefund.mockRejectedValue(new Error('boom'));

      await expect(service.refund('order-1', 3000)).resolves.toHaveProperty(
        'status',
        PaymentStatus.PARTIALLY_REFUNDED,
      );
    });
  });
});
