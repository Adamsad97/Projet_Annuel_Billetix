import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { PayoutService } from '../payout/payout.service';
import { StripeService } from '../stripe/stripe.service';
import { Payment, PaymentStatus } from './payment.entity';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let updateQueryBuilder: { update: jest.Mock; set: jest.Mock; where: jest.Mock; andWhere: jest.Mock; execute: jest.Mock };
  let stripe: { createRefund: jest.Mock; createPaymentIntent: jest.Mock };
  let payoutService: { recalculateForRefund: jest.Mock };
  let orderClient: { send: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let refundQueryBuilder: { setLock: jest.Mock; where: jest.Mock; getOne: jest.Mock };
  let refundManager: { createQueryBuilder: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((payment) => Promise.resolve(payment)),
      create: jest.fn().mockImplementation((payment) => payment),
      createQueryBuilder: jest.fn().mockReturnValue(updateQueryBuilder),
    };
    stripe = {
      createRefund: jest.fn().mockResolvedValue({}),
      createPaymentIntent: jest.fn().mockResolvedValue({
        client_secret: 'secret_123',
        payment_intent_id: 'pi_123',
      }),
    };
    payoutService = { recalculateForRefund: jest.fn().mockResolvedValue(undefined) };
    orderClient = { send: jest.fn() };
    refundQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    refundManager = {
      createQueryBuilder: jest.fn().mockReturnValue(refundQueryBuilder),
      save: jest.fn().mockImplementation((payment) => Promise.resolve(payment)),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(refundManager)),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: repo },
        { provide: StripeService, useValue: stripe },
        { provide: PayoutService, useValue: payoutService },
        { provide: 'ORDER_SERVICE', useValue: orderClient },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  describe('createIntent — montant recalculé côté serveur', () => {
    it("ignore tout montant client et utilise le total réel de la commande", async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 123.45 } }),
      );

      await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount_cents: 12345 }),
      );
    });

    it("refuse si l'appelant n'est pas le propriétaire de la commande", async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'un-autre-acheteur', total_amount_ttc: 100 } }),
      );

      await expect(
        service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' }),
      ).rejects.toThrow(RpcException);
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('refuse si la commande est déjà payée', async () => {
      repo.findOne.mockResolvedValue({ status: PaymentStatus.PAID });

      await expect(
        service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' }),
      ).rejects.toThrow(RpcException);
      expect(orderClient.send).not.toHaveBeenCalled();
    });
  });

  describe('confirmFromWebhook — idempotence anti-double-livraison Stripe', () => {
    it('marque PAID via une transition atomique et signale un premier traitement', async () => {
      repo.findOne.mockResolvedValue({ id: 'pay-1', order_id: 'order-1', status: PaymentStatus.PENDING });
      updateQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.confirmFromWebhook('pi_123');

      expect(updateQueryBuilder.andWhere).toHaveBeenCalledWith('status != :paid', { paid: PaymentStatus.PAID });
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result._wasAlreadyPaid).toBe(false);
    });

    it("signale un second webhook (déjà payé) sans re-déclencher la logique métier", async () => {
      repo.findOne.mockResolvedValue({ id: 'pay-1', order_id: 'order-1', status: PaymentStatus.PAID });
      // 0 ligne affectée : la condition "status != PAID" ne matche plus rien
      updateQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      const result = await service.confirmFromWebhook('pi_123');

      expect(result._wasAlreadyPaid).toBe(true);
    });
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
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment, status: PaymentStatus.PENDING });

      await expect(service.refund('order-1')).rejects.toThrow(RpcException);
      expect(stripe.createRefund).not.toHaveBeenCalled();
    });

    it('rejette un montant de remboursement supérieur au solde restant', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });

      await expect(service.refund('order-1', 15000)).rejects.toThrow(RpcException);
      expect(stripe.createRefund).not.toHaveBeenCalled();
    });

    it('un remboursement partiel passe le statut à PARTIALLY_REFUNDED (pas REFUNDED)', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });

      const result = await service.refund('order-1', 3000); // 30€ sur 100€

      expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(result.refunded_amount).toBe(30);
    });

    it('déclenche le recalcul du payout avec le montant réellement remboursé', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });

      await service.refund('order-1', 3000);

      expect(payoutService.recalculateForRefund).toHaveBeenCalledWith('order-1', 30, 100);
    });

    it('un remboursement total (sans montant précisé) passe le statut à REFUNDED', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });

      const result = await service.refund('order-1');

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(result.refunded_amount).toBe(100);
    });

    it('cumule un second remboursement partiel après un premier (déjà PARTIALLY_REFUNDED)', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({
        ...paidPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunded_amount: 30,
      });

      const result = await service.refund('order-1', 2000); // 20€ de plus

      expect(result.refunded_amount).toBe(50);
      expect(result.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    });

    it('passe à REFUNDED quand un second remboursement partiel épuise le solde restant', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({
        ...paidPayment,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunded_amount: 30,
      });

      const result = await service.refund('order-1', 7000); // les 70€ restants

      expect(result.refunded_amount).toBe(100);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it("n'échoue pas si le recalcul du payout lève une erreur (ne doit jamais bloquer le remboursement)", async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });
      payoutService.recalculateForRefund.mockRejectedValue(new Error('boom'));

      await expect(service.refund('order-1', 3000)).resolves.toHaveProperty(
        'status',
        PaymentStatus.PARTIALLY_REFUNDED,
      );
    });

    it('empêche le cumul au-delà du montant payé sur des appels successifs (comportement garanti par le verrou en concurrence réelle)', async () => {
      // dataSource.transaction + verrou pessimiste garantissent qu'un second
      // remboursement concurrent ne lit le solde qu'après le commit du
      // premier — on simule ici cet ordonnancement avec un état partagé.
      let currentRefunded = 0;
      refundQueryBuilder.getOne.mockImplementation(() =>
        Promise.resolve({ ...paidPayment, refunded_amount: currentRefunded }),
      );
      refundManager.save.mockImplementation((payment) => {
        currentRefunded = payment.refunded_amount;
        return Promise.resolve(payment);
      });

      const r1 = await service.refund('order-1', 6000); // 60€, solde restant : 40€
      expect(r1.refunded_amount).toBe(60);

      // Une seconde demande de 60€ doit être rejetée (solde restant réel de
      // 40€ après le premier commit), jamais cumulée jusqu'à 120€/100€.
      await expect(service.refund('order-1', 6000)).rejects.toThrow(RpcException);
      expect(currentRefunded).toBe(60);
    });
  });

  describe('markFailed — échec de paiement (payment_intent.payment_failed)', () => {
    it('marque le paiement FAILED avec le motif fourni par Stripe', async () => {
      repo.findOne.mockResolvedValue({ id: 'pay-1', order_id: 'order-1', status: PaymentStatus.PENDING });

      const result = await service.markFailed('pi_123', 'Carte refusée');

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failure_reason).toBe('Carte refusée');
    });

    it('ne fait rien si le paiement est introuvable', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.markFailed('pi_inconnu', 'Carte refusée');

      expect(result).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('ne régresse jamais un paiement déjà confirmé PAID (webhook désordonné/rejoué)', async () => {
      repo.findOne.mockResolvedValue({ id: 'pay-1', order_id: 'order-1', status: PaymentStatus.PAID });

      const result = await service.markFailed('pi_123', 'Carte refusée');

      expect(result).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
