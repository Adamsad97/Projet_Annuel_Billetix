import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { Order, OrderStatus } from '../order/order.entity';
import { RecommendationService } from './recommendation.service';

describe('RecommendationService — suggestions hebdomadaires par email', () => {
  let service: RecommendationService;
  let orderRepo: { find: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let userClient: { send: jest.Mock };
  let eventClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };

  const baseOrder = {
    id: 'order-1',
    buyer_id: 'buyer-A',
    // Volontairement différent du compte réel (auth-service) ci-dessous :
    // vérifie qu'on n'utilise jamais ces champs, potentiellement fautifs ou
    // périmés (saisis en texte libre à l'achat).
    buyer_email: 'ancien-email-errone@test.com',
    buyer_first_name: 'PrenomPerime',
    event_id: 'event-purchased',
    status: OrderStatus.TICKETS_SENT,
  };

  const purchasedEvent = { category: 'CONCERT' };
  const candidateEvent = {
    id: 'event-candidate',
    title: 'Nouveau Concert',
    start_date: new Date().toISOString(),
    venue_name: 'Zenith',
    venue_city: 'Paris',
  };

  beforeEach(async () => {
    orderRepo = { find: jest.fn().mockResolvedValue([baseOrder]) };
    notifClient = { emit: jest.fn() };
    // Opt-in : contrairement aux autres préférences, une absence de clé
    // signifie "ne pas envoyer" (cf. wantsRecommendations).
    userClient = { send: jest.fn().mockReturnValue(of({ recommendations: true })) };
    eventClient = { send: jest.fn() };
    eventClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'event.get') return of(purchasedEvent);
      if (pattern === 'event.list_for_recommendation') return of([candidateEvent]);
      return of(null);
    });
    authClient = {
      send: jest.fn().mockReturnValue(of({ email: 'alice@test.com', first_name: 'Alice' })),
    };

    const module = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'USER_SERVICE', useValue: userClient },
        { provide: 'EVENT_SERVICE', useValue: eventClient },
        { provide: 'AUTH_SERVICE', useValue: authClient },
      ],
    }).compile();

    service = module.get(RecommendationService);
  });

  it("envoie une recommandation basée sur la catégorie déjà achetée, en excluant l'événement déjà acheté, à l'email réel du compte (pas celui de l'ancienne commande)", async () => {
    await service.sendWeeklyRecommendations();

    expect(authClient.send).toHaveBeenCalledWith('auth.get_user', { id: 'buyer-A' });
    expect(eventClient.send).toHaveBeenCalledWith(
      'event.list_for_recommendation',
      expect.objectContaining({ category: 'CONCERT', exclude_event_ids: ['event-purchased'] }),
    );
    expect(notifClient.emit).toHaveBeenCalledWith(
      'notification.event_recommendations',
      expect.objectContaining({
        email: 'alice@test.com',
        firstName: 'Alice',
        events: [expect.objectContaining({ eventId: 'event-candidate', eventName: 'Nouveau Concert' })],
      }),
    );
  });

  it("n'envoie rien si le compte est introuvable côté auth-service (email manquant)", async () => {
    authClient.send.mockReturnValue(of(null));

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("n'envoie rien si la préférence recommendations n'est pas explicitement activée (opt-in)", async () => {
    userClient.send.mockReturnValue(of({})); // aucune préférence enregistrée

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("n'envoie rien si les préférences sont illisibles (fail-closed, à l'inverse des autres notifications)", async () => {
    userClient.send.mockReturnValue(throwError(() => new Error('user-service injoignable')));

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("n'envoie rien si aucun événement candidat n'est trouvé", async () => {
    eventClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'event.get') return of(purchasedEvent);
      if (pattern === 'event.list_for_recommendation') return of([]);
      return of(null);
    });

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it("n'envoie rien si l'acheteur n'a encore jamais rien acheté de catégorisable (event-service injoignable)", async () => {
    eventClient.send.mockImplementation((pattern: string) => {
      if (pattern === 'event.get') return throwError(() => new Error('event-service injoignable'));
      return of([]);
    });

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).not.toHaveBeenCalled();
  });

  it('regroupe les commandes par acheteur — un seul email même avec plusieurs commandes', async () => {
    orderRepo.find.mockResolvedValue([
      baseOrder,
      { ...baseOrder, id: 'order-2', event_id: 'event-purchased-2' },
    ]);

    await service.sendWeeklyRecommendations();

    expect(notifClient.emit).toHaveBeenCalledTimes(1);
  });
});
