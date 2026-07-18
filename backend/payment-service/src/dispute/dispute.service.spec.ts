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
});
