import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
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

    const module = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: repo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'AUTH_SERVICE', useValue: authClient },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: ValidationRequestService, useValue: validationRequestService },
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
});
