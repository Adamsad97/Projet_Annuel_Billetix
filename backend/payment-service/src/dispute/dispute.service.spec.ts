import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutService } from '../payout/payout.service';
import { Dispute, DisputeStatus, DisputeReason } from './dispute.entity';
import { DisputeService } from './dispute.service';

describe('DisputeService', () => {
  let service: DisputeService;
  let repo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let payoutService: { blockByOrder: jest.Mock; unblockByOrder: jest.Mock };

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockImplementation((dispute) => Promise.resolve(dispute)),
      create: jest.fn().mockImplementation((dispute) => dispute),
      findOne: jest.fn(),
    };
    payoutService = { blockByOrder: jest.fn(), unblockByOrder: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: getRepositoryToken(Dispute), useValue: repo },
        { provide: PayoutService, useValue: payoutService },
      ],
    }).compile();

    service = module.get(DisputeService);
  });

  describe('create', () => {
    it("bloque automatiquement le reversement de la commande à l'ouverture du litige (CDC §7.2)", async () => {
      repo.save.mockResolvedValue({ id: 'dispute-1', order_id: 'order-1' });

      await service.create({
        payment_id: 'pay-1',
        order_id: 'order-1',
        buyer_id: 'buyer-1',
        reason: DisputeReason.FRAUDULENT,
      });

      expect(payoutService.blockByOrder).toHaveBeenCalledWith(
        'order-1',
        expect.stringContaining('dispute-1'),
      );
    });
  });

  describe('resolve', () => {
    it('débloque le reversement de la commande une fois le litige tranché', async () => {
      repo.findOne.mockResolvedValue({
        id: 'dispute-1',
        order_id: 'order-1',
        status: DisputeStatus.OPEN,
      });

      await service.resolve('dispute-1', {
        status: DisputeStatus.WON,
        resolved_by: 'admin-1',
      });

      expect(payoutService.unblockByOrder).toHaveBeenCalledWith('order-1');
    });

    it('refuse de re-résoudre un litige déjà tranché', async () => {
      repo.findOne.mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.WON });

      await expect(
        service.resolve('dispute-1', { status: DisputeStatus.LOST, resolved_by: 'admin-1' }),
      ).rejects.toThrow(RpcException);
      expect(payoutService.unblockByOrder).not.toHaveBeenCalled();
    });
  });

  describe('un seul litige actif par commande', () => {
    it("refuse un second litige tant que le premier n'est pas tranché", async () => {
      repo.findOne.mockResolvedValue({ id: 'dispute-1', order_id: 'order-1', status: DisputeStatus.OPEN });
      await expect(
        service.create({ payment_id: 'pay-1', order_id: 'order-1', buyer_id: 'buyer-1', reason: DisputeReason.GENERAL }),
      ).rejects.toMatchObject({ error: { statusCode: 409 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rattache une contestation bancaire au litige déjà ouvert', async () => {
      const active = { id: 'dispute-1', order_id: 'order-1', status: DisputeStatus.UNDER_REVIEW, stripe_dispute_id: null };
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(active);
      repo.save.mockImplementation(async (value: object) => value);
      const result = await service.create({
        payment_id: 'pay-1', order_id: 'order-1', buyer_id: 'buyer-1', reason: DisputeReason.FRAUDULENT, stripe_dispute_id: 'dp_1',
      });
      expect(result).toMatchObject({ id: 'dispute-1', stripe_dispute_id: 'dp_1' });
      expect(payoutService.blockByOrder).not.toHaveBeenCalled();
    });
  });

  describe('prise en charge et contestation bancaire', () => {
    it('ouvert → en cours d\'examen, une seule fois', async () => {
      repo.findOne.mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.OPEN });
      repo.save.mockImplementation(async (value: object) => value);
      await expect(service.startReview('dispute-1')).resolves.toMatchObject({ status: DisputeStatus.UNDER_REVIEW });
      repo.findOne.mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.UNDER_REVIEW });
      await expect(service.startReview('dispute-1')).rejects.toMatchObject({ error: { statusCode: 400 } });
    });

    it('contestation perdue : litige perdu, reversement débloqué pour ajustement', async () => {
      repo.findOne.mockResolvedValue({ id: 'dispute-1', order_id: 'order-1', status: DisputeStatus.OPEN });
      repo.save.mockImplementation(async (value: object) => value);
      await expect(service.closeFromStripe('dp_1', false)).resolves.toMatchObject({ status: DisputeStatus.LOST });
      expect(payoutService.unblockByOrder).toHaveBeenCalledWith('order-1');
    });
  });
});
