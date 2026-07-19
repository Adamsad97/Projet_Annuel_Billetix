import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { OrangeMoneyProvider } from '../providers/orange-money.provider';
import { PaypalProvider } from '../providers/paypal.provider';
import { StripePaymentProvider } from '../providers/stripe.provider';
import { WaveProvider } from '../providers/wave.provider';
import { PayoutService } from '../payout/payout.service';
import { Payment, PaymentProvider, PaymentStatus } from './payment.entity';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let updateQueryBuilder: { update: jest.Mock; set: jest.Mock; where: jest.Mock; andWhere: jest.Mock; execute: jest.Mock };
  let stripeProvider: { createPayment: jest.Mock; refund: jest.Mock };
  let paypalProvider: { createPayment: jest.Mock; refund: jest.Mock; captureOrder: jest.Mock };
  let orangeMoneyProvider: { createPayment: jest.Mock; refund: jest.Mock; getTransactionStatus: jest.Mock };
  let waveProvider: { createPayment: jest.Mock; refund: jest.Mock };
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
    stripeProvider = {
      createPayment: jest.fn().mockResolvedValue({ providerPaymentId: 'pi_123', clientSecret: 'secret_123' }),
      refund: jest.fn().mockResolvedValue({ refundId: 're_123' }),
    };
    paypalProvider = {
      createPayment: jest.fn().mockResolvedValue({ providerPaymentId: 'ORDER-1', redirectUrl: 'https://paypal.com/approve' }),
      refund: jest.fn().mockResolvedValue({ refundId: 'paypal_refund_1' }),
      captureOrder: jest.fn(),
    };
    orangeMoneyProvider = {
      createPayment: jest.fn().mockResolvedValue({ providerPaymentId: 'pay_token_1', redirectUrl: 'https://om.com/pay', notifToken: 'notif_1' }),
      refund: jest.fn(),
      getTransactionStatus: jest.fn(),
    };
    waveProvider = {
      createPayment: jest.fn().mockResolvedValue({ providerPaymentId: 'cos-1', redirectUrl: 'https://pay.wave.com/c/cos-1' }),
      refund: jest.fn().mockResolvedValue({ refundId: 'cos-1' }),
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
      transaction: jest.fn().mockImplementation((transactionCallback) => transactionCallback(refundManager)),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: repo },
        { provide: ConfigService, useValue: { get: jest.fn((_key: string, fallback?: string) => fallback) } },
        { provide: StripePaymentProvider, useValue: stripeProvider },
        { provide: PaypalProvider, useValue: paypalProvider },
        { provide: OrangeMoneyProvider, useValue: orangeMoneyProvider },
        { provide: WaveProvider, useValue: waveProvider },
        { provide: PayoutService, useValue: payoutService },
        { provide: 'ORDER_SERVICE', useValue: orderClient },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  describe('createIntent — montant recalculé côté serveur, prestataire selon le choix de l\'acheteur', () => {
    it("ignore tout montant client et utilise le total réel de la commande (Stripe)", async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 123.45, payment_method: 'STRIPE' } }),
      );

      const result = await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

      expect(stripeProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 12345 }),
      );
      expect(result.client_secret).toBe('secret_123');
      expect(result.provider).toBe(PaymentProvider.STRIPE);
    });

    it.each([
      ['APPLE_PAY', PaymentProvider.STRIPE],
      ['GOOGLE_PAY', PaymentProvider.STRIPE],
    ])(
      '%s utilise le même prestataire Stripe (même PaymentIntent, méthode choisie côté frontend)',
      async (paymentMethod, expectedProvider) => {
        orderClient.send.mockReturnValue(
          of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 50, payment_method: paymentMethod } }),
        );

        const result = await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

        expect(stripeProvider.createPayment).toHaveBeenCalled();
        expect(result.provider).toBe(expectedProvider);
      },
    );

    it('redirige vers PayPal quand payment_method = PAYPAL', async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 50, payment_method: 'PAYPAL' } }),
      );

      const result = await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

      expect(paypalProvider.createPayment).toHaveBeenCalled();
      expect(result.redirect_url).toBe('https://paypal.com/approve');
      expect(result.provider).toBe(PaymentProvider.PAYPAL);
    });

    it('redirige vers Orange Money quand payment_method = ORANGE_MONEY', async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 50, payment_method: 'ORANGE_MONEY' } }),
      );

      const result = await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

      expect(orangeMoneyProvider.createPayment).toHaveBeenCalled();
      expect(result.redirect_url).toBe('https://om.com/pay');
      expect(result.provider).toBe(PaymentProvider.ORANGE_MONEY);
    });

    it('redirige vers Wave quand payment_method = WAVE', async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 50, payment_method: 'WAVE' } }),
      );

      const result = await service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' });

      expect(waveProvider.createPayment).toHaveBeenCalled();
      expect(result.redirect_url).toBe('https://pay.wave.com/c/cos-1');
      expect(result.provider).toBe(PaymentProvider.WAVE);
    });

    it('refuse un moyen de paiement non supporté', async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'buyer-1', total_amount_ttc: 50, payment_method: 'BITCOIN' } }),
      );

      await expect(
        service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' }),
      ).rejects.toThrow(RpcException);
    });

    it("refuse si l'appelant n'est pas le propriétaire de la commande", async () => {
      orderClient.send.mockReturnValue(
        of({ order: { buyer_id: 'un-autre-acheteur', total_amount_ttc: 100, payment_method: 'STRIPE' } }),
      );

      await expect(
        service.createIntent({ order_id: 'order-1', buyer_id: 'buyer-1', buyer_email: 'jean@example.com' }),
      ).rejects.toThrow(RpcException);
      expect(stripeProvider.createPayment).not.toHaveBeenCalled();
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

  describe('confirmPaypalOrderApproved — capture serveur après approbation', () => {
    it("capture les fonds et remplace l'ID de commande par l'ID de capture réel", async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.PAYPAL,
        provider_payment_id: 'ORDER-1',
        status: PaymentStatus.PENDING,
      });
      paypalProvider.captureOrder.mockResolvedValue({ captureId: 'CAPTURE-1', status: 'COMPLETED' });
      updateQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.confirmPaypalOrderApproved('ORDER-1');

      expect(paypalProvider.captureOrder).toHaveBeenCalledWith('ORDER-1');
      expect(result?.provider_payment_id).toBe('CAPTURE-1');
      expect(result?.status).toBe(PaymentStatus.PAID);
      expect(result?._wasAlreadyPaid).toBe(false);
    });

    it('marque FAILED si la capture PayPal ne renvoie pas COMPLETED', async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.PAYPAL,
        provider_payment_id: 'ORDER-1',
        status: PaymentStatus.PENDING,
      });
      paypalProvider.captureOrder.mockResolvedValue({ captureId: 'CAPTURE-1', status: 'DECLINED' });

      const result = await service.confirmPaypalOrderApproved('ORDER-1');

      expect(result?.status).toBe(PaymentStatus.FAILED);
    });

    it('retourne null si aucun paiement PayPal ne correspond', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.confirmPaypalOrderApproved('ORDER-INCONNU');
      expect(result).toBeNull();
      expect(paypalProvider.captureOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmOrangeMoneyCallback — vérification jeton + statut réel', () => {
    it('refuse un jeton de notification qui ne correspond pas', async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.ORANGE_MONEY,
        provider_payment_id: 'pay_token_1',
        provider_notif_token: 'le-vrai-jeton',
        status: PaymentStatus.PENDING,
      });

      await expect(
        service.confirmOrangeMoneyCallback('pay_token_1', 'order-1', 'jeton-falsifie'),
      ).rejects.toThrow(RpcException);
      expect(orangeMoneyProvider.getTransactionStatus).not.toHaveBeenCalled();
    });

    it('valide le paiement si le jeton correspond et le statut réel est SUCCESS', async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.ORANGE_MONEY,
        provider_payment_id: 'pay_token_1',
        provider_notif_token: 'notif-1',
        status: PaymentStatus.PENDING,
      });
      orangeMoneyProvider.getTransactionStatus.mockResolvedValue('SUCCESS');
      updateQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.confirmOrangeMoneyCallback('pay_token_1', 'order-1', 'notif-1');

      expect(result?.status).toBe(PaymentStatus.PAID);
    });

    it("marque FAILED si le statut réel Orange Money n'est pas SUCCESS", async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.ORANGE_MONEY,
        provider_payment_id: 'pay_token_1',
        provider_notif_token: 'notif-1',
        status: PaymentStatus.PENDING,
      });
      orangeMoneyProvider.getTransactionStatus.mockResolvedValue('FAILED');

      const result = await service.confirmOrangeMoneyCallback('pay_token_1', 'order-1', 'notif-1');

      expect(result?.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('confirmWaveCheckoutCompleted', () => {
    it('marque PAID via la même transition atomique idempotente', async () => {
      repo.findOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        provider: PaymentProvider.WAVE,
        provider_payment_id: 'cos-1',
        status: PaymentStatus.PENDING,
      });
      updateQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      const result = await service.confirmWaveCheckoutCompleted('cos-1');

      expect(result?.status).toBe(PaymentStatus.PAID);
    });
  });

  describe('refund — remboursement total et partiel (Stripe)', () => {
    const paidPayment = {
      id: 'pay-1',
      order_id: 'order-1',
      amount: 100,
      provider: PaymentProvider.STRIPE,
      provider_payment_id: 'pi_123',
      status: PaymentStatus.PAID,
      refunded_amount: null,
    };

    it('rejette un remboursement sur un paiement non payé', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment, status: PaymentStatus.PENDING });

      await expect(service.refund('order-1')).rejects.toThrow(RpcException);
      expect(stripeProvider.refund).not.toHaveBeenCalled();
    });

    it('rejette un montant de remboursement supérieur au solde restant', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({ ...paidPayment });

      await expect(service.refund('order-1', 15000)).rejects.toThrow(RpcException);
      expect(stripeProvider.refund).not.toHaveBeenCalled();
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

      const firstRefundResult = await service.refund('order-1', 6000); // 60€, solde restant : 40€
      expect(firstRefundResult.refunded_amount).toBe(60);

      // Une seconde demande de 60€ doit être rejetée (solde restant réel de
      // 40€ après le premier commit), jamais cumulée jusqu'à 120€/100€.
      await expect(service.refund('order-1', 6000)).rejects.toThrow(RpcException);
      expect(currentRefunded).toBe(60);
    });
  });

  describe('refund — dispatche vers le bon prestataire selon payment.provider', () => {
    it('utilise PaypalProvider.refund pour un paiement PayPal', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        amount: 100,
        provider: PaymentProvider.PAYPAL,
        provider_payment_id: 'CAPTURE-1',
        status: PaymentStatus.PAID,
        refunded_amount: null,
      });

      await service.refund('order-1');

      expect(paypalProvider.refund).toHaveBeenCalledWith('CAPTURE-1', undefined);
      expect(stripeProvider.refund).not.toHaveBeenCalled();
    });

    it('utilise WaveProvider.refund pour un paiement Wave', async () => {
      refundQueryBuilder.getOne.mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        amount: 100,
        provider: PaymentProvider.WAVE,
        provider_payment_id: 'cos-1',
        status: PaymentStatus.PAID,
        refunded_amount: null,
      });

      await service.refund('order-1');

      expect(waveProvider.refund).toHaveBeenCalledWith('cos-1', undefined);
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
