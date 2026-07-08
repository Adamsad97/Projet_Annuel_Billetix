import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { TicketCategoryService } from '../ticket-category/ticket-category.service';
import { ValidationRequestService } from '../validation-request/validation-request.service';
import { Event, EventStatus } from './event.entity';
import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let authClient: { send: jest.Mock };
  let validationRequestService: {
    getByEvent: jest.Mock;
    create: jest.Mock;
    getById: jest.Mock;
    respond: jest.Mock;
  };
  let ticketCategoryService: { getByEvent: jest.Mock; create: jest.Mock };

  const config = {
    commission_standard_percent: 10,
    commission_large_event_percent: 8,
    large_event_threshold: 1000,
    event_validation_deadline_hours: 48,
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    platformConfig = { get: jest.fn().mockResolvedValue(config) };
    notifClient = { emit: jest.fn() };
    authClient = { send: jest.fn().mockReturnValue(of({ email: 'organisateur@example.com', first_name: 'Jean' })) };
    validationRequestService = {
      getByEvent: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      getById: jest.fn(),
      respond: jest.fn(),
    };
    ticketCategoryService = {
      getByEvent: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: repo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'AUTH_SERVICE', useValue: authClient },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: ValidationRequestService, useValue: validationRequestService },
        { provide: TicketCategoryService, useValue: ticketCategoryService },
      ],
    }).compile();

    service = module.get(EventService);
  });

  describe('create', () => {
    it('applique la commission standard pour une jauge sous le seuil', async () => {
      const event = await service.create('organizer-1', { total_capacity: 500 } as any);
      expect(event.commission_rate).toBe(10);
    });

    it('applique la commission dégressive au-delà du seuil de grande jauge', async () => {
      const event = await service.create('organizer-1', { total_capacity: 1500 } as any);
      expect(event.commission_rate).toBe(8);
    });
  });

  describe('validate', () => {
    it("ramène la commission à 0% si l'événement est à but non lucratif", async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: EventStatus.PENDING_VALIDATION,
        total_capacity: 500,
        is_non_profit: true,
        organizer_id: 'organizer-1',
      });

      const event = await service.validate('evt-1', 'admin-1');

      expect(event.commission_rate).toBe(0);
      expect(event.status).toBe(EventStatus.PUBLISHED);
    });

    it('conserve la commission standard/dégressive pour un événement lucratif', async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: EventStatus.PENDING_VALIDATION,
        total_capacity: 1500,
        is_non_profit: false,
        organizer_id: 'organizer-1',
      });

      const event = await service.validate('evt-1', 'admin-1');

      expect(event.commission_rate).toBe(8);
    });
  });

  describe('listPending — délai de traitement (CDC : 48h ouvrées configurables)', () => {
    it('calcule le délai à partir de la config admin, pas d\'une valeur figée dans le code', async () => {
      const submittedAt = new Date('2026-07-01T10:00:00.000Z');
      repo.find.mockResolvedValue([
        { id: 'evt-1', validation_requested_at: submittedAt, created_at: submittedAt, deadline_alert_sent: false },
      ]);
      platformConfig.get.mockResolvedValue({ ...config, event_validation_deadline_hours: 10 });

      const [result] = await service.listPending();

      expect(result.validation_deadline.toISOString()).toBe('2026-07-01T20:00:00.000Z');
    });

    it('marque un événement en retard quand le délai est dépassé', async () => {
      const submittedAt = new Date(Date.now() - 100 * 60 * 60 * 1000); // soumis il y a 100h
      repo.find.mockResolvedValue([
        { id: 'evt-1', validation_requested_at: submittedAt, created_at: submittedAt, deadline_alert_sent: false },
      ]);

      const [result] = await service.listPending();

      expect(result.is_overdue).toBe(true);
    });

    it('ne marque pas en retard un événement encore dans les délais', async () => {
      const submittedAt = new Date();
      repo.find.mockResolvedValue([
        { id: 'evt-1', validation_requested_at: submittedAt, created_at: submittedAt, deadline_alert_sent: false },
      ]);

      const [result] = await service.listPending();

      expect(result.is_overdue).toBe(false);
    });

    it('suspend le délai pendant une demande de complément d\'info non répondue', async () => {
      const submittedAt = new Date(Date.now() - 47 * 60 * 60 * 1000); // soumis il y a 47h (proche de la limite 48h)
      const infoRequestedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // demande ouverte depuis 24h
      repo.find.mockResolvedValue([
        { id: 'evt-1', validation_requested_at: submittedAt, created_at: submittedAt, deadline_alert_sent: false },
      ]);
      validationRequestService.getByEvent.mockResolvedValue([
        { created_at: infoRequestedAt, responded_at: null },
      ]);

      const [result] = await service.listPending();

      // Sans la suspension, l'événement serait en retard (47h > 48h - marge) ;
      // avec les 24h de pause ajoutées, il ne l'est pas encore.
      expect(result.is_overdue).toBe(false);
    });
  });

  describe('requestInfo — demande de complément d\'information', () => {
    it("refuse si l'événement n'est pas en attente de validation", async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', status: EventStatus.DRAFT });

      await expect(service.requestInfo('evt-1', 'admin-1', 'Précisez le lieu')).rejects.toThrow(RpcException);
      expect(validationRequestService.create).not.toHaveBeenCalled();
    });

    it('crée la demande et notifie l\'organisateur par e-mail', async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        status: EventStatus.PENDING_VALIDATION,
        organizer_id: 'organizer-1',
        title: 'Concert Test',
      });

      await service.requestInfo('evt-1', 'admin-1', 'Précisez le lieu');

      expect(validationRequestService.create).toHaveBeenCalledWith('evt-1', 'admin-1', 'Précisez le lieu');
      expect(notifClient.emit).toHaveBeenCalledWith(
        'notification.event_info_requested',
        expect.objectContaining({ event_name: 'Concert Test', message: 'Précisez le lieu' }),
      );
    });
  });

  describe('respondToInfoRequest — réponse organisateur', () => {
    it('refuse si la demande est introuvable', async () => {
      validationRequestService.getById.mockResolvedValue(null);

      await expect(service.respondToInfoRequest('req-1', 'organizer-1', 'Voici les infos')).rejects.toThrow(RpcException);
    });

    it("refuse si l'organisateur n'est pas propriétaire de l'événement", async () => {
      validationRequestService.getById.mockResolvedValue({ id: 'req-1', event_id: 'evt-1' });
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-2' });

      await expect(service.respondToInfoRequest('req-1', 'organizer-1', 'Voici les infos')).rejects.toThrow(RpcException);
      expect(validationRequestService.respond).not.toHaveBeenCalled();
    });

    it('enregistre la réponse et relance le délai (deadline_alert_sent remis à false)', async () => {
      validationRequestService.getById.mockResolvedValue({ id: 'req-1', event_id: 'evt-1' });
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', deadline_alert_sent: true });

      await service.respondToInfoRequest('req-1', 'organizer-1', 'Voici les infos');

      expect(validationRequestService.respond).toHaveBeenCalledWith('req-1', 'Voici les infos');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ deadline_alert_sent: false }));
    });
  });

  describe('update — modification post-publication', () => {
    it('autorise toute modification tant que le brouillon n\'est pas soumis', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.DRAFT });

      const event = await service.update('evt-1', 'organizer-1', { venue_name: 'Nouvelle salle', start_date: new Date() } as any);

      expect(event.venue_name).toBe('Nouvelle salle');
    });

    it("ignore silencieusement status/commission_rate/validated_by même en brouillon (mass assignment)", async () => {
      repo.findOne.mockResolvedValue({
        id: 'evt-1',
        organizer_id: 'organizer-1',
        status: EventStatus.DRAFT,
        commission_rate: 10,
      });

      const event = await service.update('evt-1', 'organizer-1', {
        title: 'Titre légitime',
        status: EventStatus.PUBLISHED,
        commission_rate: 0,
        validated_by: 'moi-meme',
        validated_at: new Date(),
        organizer_id: 'un-autre-organisateur',
      } as any);

      expect(event.title).toBe('Titre légitime');
      expect(event.status).toBe(EventStatus.DRAFT);
      expect(event.commission_rate).toBe(10);
      expect((event as any).validated_by).toBeUndefined();
      expect(event.organizer_id).toBe('organizer-1');
    });

    it('refuse toute modification sur un événement terminé/annulé/archivé', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.CANCELLED });

      await expect(
        service.update('evt-1', 'organizer-1', { description: 'Nouvelle description' } as any),
      ).rejects.toThrow(RpcException);
    });

    it('autorise les champs cosmétiques sur un événement publié', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });

      const event = await service.update('evt-1', 'organizer-1', {
        description: 'Description mise à jour',
        poster_url: 'http://example.com/new-poster.jpg',
        access_conditions: 'Dès 18 ans',
      } as any);

      expect(event.description).toBe('Description mise à jour');
    });

    it('refuse un champ sensible (date, lieu, capacité...) sur un événement publié', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });

      await expect(
        service.update('evt-1', 'organizer-1', { venue_name: 'Nouvelle salle' } as any),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuse un mélange champ cosmétique + champ sensible sur un événement publié', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });

      await expect(
        service.update('evt-1', 'organizer-1', { description: 'OK', total_capacity: 500 } as any),
      ).rejects.toThrow(RpcException);
    });

    it('autorise les champs cosmétiques pendant l\'attente de validation', async () => {
      repo.findOne.mockResolvedValue({ id: 'evt-1', organizer_id: 'organizer-1', status: EventStatus.PENDING_VALIDATION });

      const event = await service.update('evt-1', 'organizer-1', { description: 'Précision ajoutée' } as any);

      expect(event.description).toBe('Précision ajoutée');
    });
  });

  describe('duplicate — événement récurrent (duplication simple)', () => {
    const original = {
      id: 'evt-1',
      organizer_id: 'organizer-1',
      title: 'Concert Été',
      description: 'Un super concert',
      category: 'CONCERT',
      is_non_profit: false,
      non_profit_document_url: null,
      start_date: new Date('2026-08-01'),
      end_date: new Date('2026-08-01'),
      timezone: 'Europe/Paris',
      venue_name: 'Zenith',
      venue_address_line1: '1 rue du Zenith',
      venue_address_line2: null,
      venue_city: 'Paris',
      venue_postal_code: '75001',
      venue_country: 'France',
      venue_latitude: null,
      venue_longitude: null,
      poster_url: 'http://example.com/poster.jpg',
      total_capacity: 500,
      sales_start_date: new Date('2026-06-01'),
      sales_end_date: new Date('2026-07-31'),
      refund_policy: 'REFUNDABLE',
      refund_deadline_days: 7,
      access_conditions: null,
    };

    it("refuse si l'appelant n'est pas propriétaire de l'événement d'origine", async () => {
      repo.findOne.mockResolvedValue(original);

      await expect(service.duplicate('evt-1', 'un-autre-organisateur')).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('crée un nouveau brouillon avec le titre suffixé "(copie)"', async () => {
      repo.findOne.mockResolvedValue(original);

      const clone = await service.duplicate('evt-1', 'organizer-1');

      expect(clone.title).toBe('Concert Été (copie)');
      expect(clone.status).toBe(EventStatus.DRAFT);
      expect(clone.venue_name).toBe('Zenith');
    });

    it('copie les catégories de billets avec un quota neuf (pas les ventes déjà faites)', async () => {
      repo.findOne.mockResolvedValue(original);
      ticketCategoryService.getByEvent.mockResolvedValue([
        { name: 'Standard', description: 'Accès général', price_ht: '50.00', quota: 400, remaining_quota: 50, max_per_order: 10, visibility: 'PUBLIC' },
        { name: 'VIP', description: null, price_ht: '150.00', quota: 100, remaining_quota: 0, max_per_order: 4, visibility: 'PUBLIC' },
      ]);

      await service.duplicate('evt-1', 'organizer-1');

      expect(ticketCategoryService.create).toHaveBeenCalledTimes(2);
      expect(ticketCategoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Standard', price_ht: 50, quota: 400 }),
        'organizer-1',
      );
      // remaining_quota n'est jamais transmis — TicketCategoryService.create()
      // le réinitialise toujours à quota (aucune vente sur le nouvel événement).
      expect(ticketCategoryService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ remaining_quota: expect.anything() }),
        expect.anything(),
      );
    });
  });
});
