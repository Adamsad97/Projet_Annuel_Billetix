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

  it("désactivation : email dédié à l'organisateur, plus celui du refus de validation", async () => {
    await controller.onEventSuspended(
      { email: 'orga@example.com', firstName: 'Awa', event_id: 'evt-1', event_name: 'Soirée Jazz', reason: 'Vérification de la salle' },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options).toMatchObject({ to: 'orga@example.com', template: 'organizer-event-notice' });
    expect(options.subject).toContain('Ventes suspendues');
    expect(options.context).toMatchObject({ message: 'Vérification de la salle', eventUrl: 'http://localhost:3000/dashboard/evenements/evt-1' });
  });

  it.each([
    ['HIDDEN', 'masqué'],
    ['UNHIDDEN', 'de nouveau visible'],
    ['UNSUSPENDED', 'Ventes rouvertes'],
    ['CANCELLED_BY_ADMIN', 'annulé'],
    ['CANCELLATION_MESSAGE', 'Nouveau message'],
    ['CANCELLATION_REJECTED', 'refusée'],
    ['CANCELLATION_APPROVED', 'acceptée'],
    ['POSTPONEMENT_MESSAGE', 'Nouveau message'],
    ['POSTPONEMENT_REJECTED', 'refusée'],
    ['POSTPONEMENT_APPROVED', 'acceptée'],
    ['NON_PROFIT_VERIFIED', 'validé'],
    ['NON_PROFIT_REJECTED', 'refusé'],
    ['CREATED_FOR_YOU', 'créé'],
  ] as const)("action admin %s : l'organisateur est prévenu", async (kind, subjectPart) => {
    await controller.onOrganizerEventNotice(
      { email: 'orga@example.com', firstName: 'Awa', event_id: 'evt-1', event_name: 'Soirée Jazz', kind, message: '  Motif  ' },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options.template).toBe('organizer-event-notice');
    expect(options.subject).toContain(subjectPart);
    expect(options.context.message).toBe('Motif');
  });

  it.each([
    ['POSTPONED', 'Événement reporté', false],
    ['RESCHEDULED', 'Nouvelle date', true],
  ] as const)('report %s : acheteur prévenu', async (announcement, subjectPart, rescheduled) => {
    await controller.onEventPostponed(
      {
        email: 'jean@example.com',
        firstName: 'Jean',
        eventName: 'Soirée Jazz',
        announcement,
        originalDate: 'samedi 24 octobre 2026',
        newDate: rescheduled ? 'samedi 7 novembre 2026' : undefined,
        refundDeadline: rescheduled ? '21 novembre 2026' : undefined,
      },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options).toMatchObject({ to: 'jean@example.com', template: 'event-postponed' });
    expect(options.subject).toContain(subjectPart);
    expect(options.context).toMatchObject({ rescheduled, ordersUrl: 'http://localhost:3000/profil/commandes' });
  });

  it.each([
    ['CANCELLATION', 'NEW', "Nouvelle demande d'annulation"],
    ['POSTPONEMENT', 'NEW', 'Nouvelle demande de report'],
    ['POSTPONEMENT', 'MESSAGE', "Réponse de l'organisateur"],
  ] as const)('demande %s (%s) : les admins sont prévenus', async (kind, action, subjectPart) => {
    await controller.onAdminChangeRequest(
      {
        email: 'admin@example.com',
        firstName: 'Awa',
        kind,
        action,
        eventName: 'Soirée Jazz',
        eventDate: 'samedi 24 octobre 2026',
        organizerName: 'Les Nuits',
        text: 'Salle indisponible',
      },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options).toMatchObject({ to: 'admin@example.com', template: 'admin-change-request' });
    expect(options.subject).toContain(subjectPart);
    expect(options.context.requestsUrl).toBe('http://localhost:3000/admin/annulations');
  });

  it("alerte admin générique : lien vers la page d'administration", async () => {
    await controller.onAdminNotice(
      {
        email: 'admin@example.com',
        firstName: 'Awa',
        subject: "Nouvelle vérification d'identité — Les Nuits",
        headline: "Vérification d'identité à examiner",
        intro: 'Un organisateur a envoyé ses pièces.',
        details: ['Organisateur : Les Nuits'],
        ctaLabel: 'Examiner la demande',
        ctaPath: '/admin/utilisateurs/abc',
      },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options).toMatchObject({ to: 'admin@example.com', template: 'admin-notice', subject: "Nouvelle vérification d'identité — Les Nuits" });
    expect(options.context.ctaUrl).toBe('http://localhost:3000/admin/utilisateurs/abc');
  });

  it("litige tranché : l'acheteur reçoit l'issue et le montant remboursé", async () => {
    await controller.onDisputeResolvedBuyer(
      { email: 'jean@example.com', firstName: 'Jean', eventName: 'Soirée Jazz', orderReference: 'ORD-1', status: 'LOST', refundAmount: '45.00' },
      rmqContext,
    );
    const [options] = mail.send.mock.calls[0];
    expect(options).toMatchObject({ to: 'jean@example.com', template: 'dispute-resolved-buyer' });
    expect(options.context).toMatchObject({ isLost: true, refundAmount: '45.00', ordersUrl: 'http://localhost:3000/profil/commandes' });
  });
});
