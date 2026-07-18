import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { PayoutService } from '../payout/payout.service';
import { PayoutSchedulerService } from './payout-scheduler.service';

describe('PayoutSchedulerService', () => {
  let service: PayoutSchedulerService;
  let payoutService: {
    getDuePayouts: jest.Mock;
    process: jest.Mock;
    getExpiredBlockedPayouts: jest.Mock;
    unblock: jest.Mock;
  };
  let userClient: { send: jest.Mock };
  let platformConfig: { get: jest.Mock };

  const duePayout = { id: 'payout-1', organizer_id: 'org-1' };

  beforeEach(async () => {
    payoutService = {
      getDuePayouts: jest.fn().mockResolvedValue([duePayout]),
      process: jest.fn(),
      getExpiredBlockedPayouts: jest.fn().mockResolvedValue([]),
      unblock: jest.fn(),
    };
    userClient = { send: jest.fn() };
    platformConfig = { get: jest.fn().mockResolvedValue({ dispute_payout_block_max_days: 30 }) };

    const module = await Test.createTestingModule({
      providers: [
        PayoutSchedulerService,
        { provide: PayoutService, useValue: payoutService },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: 'USER_SERVICE', useValue: userClient },
      ],
    }).compile();

    service = module.get(PayoutSchedulerService);
  });

  it("ne traite pas le reversement si le compte Stripe Connect n'est pas onboardé", async () => {
    userClient.send.mockReturnValue(
      of({ stripe_connect_account_id: null, stripe_connect_onboarded: false, kyc_status: 'VERIFIED' }),
    );

    await service.processDuePayouts();

    expect(payoutService.process).not.toHaveBeenCalled();
  });

  it('ne traite pas le reversement si le KYC n\'est pas VERIFIED', async () => {
    userClient.send.mockReturnValue(
      of({ stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true, kyc_status: 'PENDING' }),
    );

    await service.processDuePayouts();

    expect(payoutService.process).not.toHaveBeenCalled();
  });

  it('traite le reversement quand Stripe Connect est onboardé et le KYC validé', async () => {
    userClient.send.mockReturnValue(
      of({ stripe_connect_account_id: 'acct_1', stripe_connect_onboarded: true, kyc_status: 'VERIFIED' }),
    );

    await service.processDuePayouts();

    expect(payoutService.process).toHaveBeenCalledWith('payout-1', 'acct_1');
  });

  it("n'appelle rien si aucun reversement n'est échu", async () => {
    payoutService.getDuePayouts.mockResolvedValue([]);

    await service.processDuePayouts();

    expect(userClient.send).not.toHaveBeenCalled();
    expect(payoutService.process).not.toHaveBeenCalled();
  });

  describe('unblockExpiredDisputePayouts', () => {
    it('débloque les reversements bloqués depuis plus longtemps que la limite configurée (jamais figée dans le code)', async () => {
      payoutService.getExpiredBlockedPayouts.mockResolvedValue([{ id: 'payout-2' }]);

      await service.unblockExpiredDisputePayouts();

      expect(payoutService.getExpiredBlockedPayouts).toHaveBeenCalledWith(30);
      expect(payoutService.unblock).toHaveBeenCalledWith('payout-2');
    });

    it("ne fait rien si aucun reversement bloqué n'a dépassé le délai", async () => {
      payoutService.getExpiredBlockedPayouts.mockResolvedValue([]);

      await service.unblockExpiredDisputePayouts();

      expect(payoutService.unblock).not.toHaveBeenCalled();
    });
  });
});
