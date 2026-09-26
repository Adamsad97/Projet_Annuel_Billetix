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

  it('billet offert : prévient le bénéficiaire et confirme à l’expéditeur, sans QR ni PDF', async () => {
    await controller.onTicketTransferred(
      {
        ticketReference: 'TKT-2026-000001',
        eventName: 'Concert Test',
        eventDate: '12 octobre 2026',
        eventVenue: 'Zénith',
        categoryName: 'Standard',
        senderEmail: 'jean@example.com',
        senderFirstName: 'Jean',
        senderLastName: 'Dupont',
        recipientEmail: 'marie@example.com',
        recipientFirstName: 'Marie',
        holderFirstName: 'Paul',
        holderLastName: 'Martin',
        transferredAt: '26/09/2026 à 14:03',
      },
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledTimes(2);
    const [received, sent] = mail.send.mock.calls.map(([options]) => options);
    expect(received).toMatchObject({ to: 'marie@example.com', template: 'ticket-gift-received' });
    expect(received.context.ticketsUrl).toContain('reauth=1');
    expect(sent).toMatchObject({ to: 'jean@example.com', template: 'ticket-gift-sent' });
    expect(received.attachments).toBeUndefined();
  });

  it('transfert annulé : billet restitué à l’expéditeur, retiré au bénéficiaire', async () => {
    await controller.onTransferReverted(
      {
        ticketReference: 'TKT-2026-000001',
        eventName: 'Concert Test',
        eventDate: '12 octobre 2026',
        senderEmail: 'jean@example.com',
        senderFirstName: 'Jean',
        recipientEmail: 'marie@example.com',
        recipientFirstName: 'Marie',
        holderFirstName: 'Jean',
        holderLastName: 'Dupont',
      },
      rmqContext,
    );

    const [sender, recipient] = mail.send.mock.calls.map(([options]) => options);
    expect(sender).toMatchObject({ to: 'jean@example.com', template: 'transfer-reverted-sender' });
    expect(sender.context.ticketsUrl).toContain('reauth=1');
    expect(recipient).toMatchObject({ to: 'marie@example.com', template: 'transfer-reverted-recipient' });
  });

  it('demande d’annulation refusée : motif transmis à l’expéditeur', async () => {
    await controller.onTransferRevertRejected(
      {
        ticketReference: 'TKT-2026-000001',
        eventName: 'Concert Test',
        eventDate: '12 octobre 2026',
        senderEmail: 'jean@example.com',
        senderFirstName: 'Jean',
        recipientEmail: 'marie@example.com',
        decisionReason: 'Billet déjà remis en main propre',
      },
      rmqContext,
    );

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jean@example.com',
        template: 'transfer-revert-rejected',
        context: expect.objectContaining({ decisionReason: 'Billet déjà remis en main propre' }),
      }),
    );
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
