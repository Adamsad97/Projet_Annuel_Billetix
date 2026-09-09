import { ConfigService } from '@nestjs/config';
import { RmqContext } from '@nestjs/microservices';
import { MailService } from '../mail/mail.service';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mail: { send: jest.Mock };
  let rmqContext: RmqContext;

  beforeEach(() => {
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue('http://localhost:3000') } as unknown as ConfigService;
    controller = new NotificationController(mail as unknown as MailService, config);
    rmqContext = {
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
      rmqContext,
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
      rmqContext,
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
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'organisateur@example.com',
        subject: expect.stringContaining('Festival Test'),
        template: 'dispute-opened',
      }),
    );
  });

  it('envoie la newsletter avec le sujet et le contenu rédigés par l\'admin', async () => {
    await controller.onNewsletter(
      {
        email: 'jean@example.com',
        firstName: 'Jean',
        subject: 'Les nouveautés du mois',
        body: 'Découvre les concerts à venir.',
      },
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jean@example.com',
        subject: 'Les nouveautés du mois',
        template: 'newsletter',
        context: expect.objectContaining({ body: 'Découvre les concerts à venir.' }),
      }),
    );
  });

  it("envoie les recommandations d'événements avec un lien construit vers chaque événement", async () => {
    await controller.onEventRecommendations(
      {
        email: 'jean@example.com',
        firstName: 'Jean',
        events: [
          {
            eventId: 'event-1',
            eventName: 'Concert Jazz',
            eventDate: '12 décembre 2026',
            venueName: 'Le Zenith',
            city: 'Paris',
          },
        ],
      },
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jean@example.com',
        subject: expect.stringContaining('événements'),
        template: 'event-recommendations',
        context: expect.objectContaining({
          events: [expect.objectContaining({ eventName: 'Concert Jazz', eventUrl: 'http://localhost:3000/evenements/event-1' })],
        }),
      }),
    );
  });

  it("envoie au vendeur la confirmation que son billet a été mis en vente", async () => {
    await controller.onResaleListed(
      {
        email: 'jean@example.com',
        firstName: 'Jean',
        eventName: 'Concert Test',
        resalePrice: '15.00',
      },
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jean@example.com',
        subject: expect.stringContaining('Concert Test'),
        template: 'resale-listed',
        context: expect.objectContaining({
          resalePrice: '15.00',
          ticketsUrl: 'http://localhost:3000/profil/billets',
        }),
      }),
    );
  });
});
