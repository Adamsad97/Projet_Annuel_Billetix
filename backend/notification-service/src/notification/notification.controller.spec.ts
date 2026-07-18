import { ConfigService } from '@nestjs/config';
import { RmqContext } from '@nestjs/microservices';
import { MailService } from '../mail/mail.service';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mail: { send: jest.Mock };
  let ctx: RmqContext;

  beforeEach(() => {
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue('http://localhost:3000') } as unknown as ConfigService;
    controller = new NotificationController(mail as unknown as MailService, config);
    ctx = {
      getChannelRef: () => ({ ack: jest.fn() }),
      getMessage: () => ({}),
    } as unknown as RmqContext;
  });

  it('envoie l\'email de remboursement effectué avec le bon template et sujet', async () => {
    await controller.onRefundCompleted(
      {
        email: 'jean@example.com',
        firstName: 'Jean',
        orderReference: 'ORD-2026-00001',
        eventName: 'Concert Test',
        amount: '50.00',
        refundType: 'Remboursement total',
      },
      ctx,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jean@example.com',
        subject: expect.stringContaining('ORD-2026-00001'),
        template: 'refund-completed',
      }),
    );
  });

  it("envoie l'email de reversement effectué à l'organisateur", async () => {
    await controller.onPayoutCompleted(
      {
        email: 'organisateur@example.com',
        firstName: 'Marie',
        eventName: 'Festival Test',
        amount: '870.00',
        payoutDate: '18 juillet 2026',
      },
      ctx,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'organisateur@example.com',
        subject: expect.stringContaining('Festival Test'),
        template: 'payout-completed',
      }),
    );
  });

  it("envoie l'email de litige ouvert à l'organisateur", async () => {
    await controller.onDisputeOpened(
      {
        email: 'organisateur@example.com',
        firstName: 'Marie',
        eventName: 'Festival Test',
        orderReference: 'ORD-2026-00002',
        reason: 'FRAUDULENT',
      },
      ctx,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'organisateur@example.com',
        subject: expect.stringContaining('Festival Test'),
        template: 'dispute-opened',
      }),
    );
  });
});
