import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { EventService } from '../event/event.service';
import { Event } from '../event/event.entity';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { EventLifecycleService } from './event-lifecycle.service';

describe('EventLifecycleService', () => {
  let service: EventLifecycleService;
  let queryBuilder: { update: jest.Mock; set: jest.Mock; where: jest.Mock; andWhere: jest.Mock; execute: jest.Mock };
  let repo: { createQueryBuilder: jest.Mock; update: jest.Mock };
  let eventService: { listPending: jest.Mock };
  let platformConfig: { get: jest.Mock };
  let adminClient: { send: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn().mockResolvedValue(undefined),
    };
    eventService = { listPending: jest.fn().mockResolvedValue([]) };
    platformConfig = { get: jest.fn().mockResolvedValue({ event_archive_delay_days: 30 }) };
    adminClient = { send: jest.fn().mockReturnValue(of({})) };

    const module = await Test.createTestingModule({
      providers: [
        EventLifecycleService,
        { provide: getRepositoryToken(Event), useValue: repo },
        { provide: EventService, useValue: eventService },
        { provide: PlatformConfigCache, useValue: platformConfig },
        { provide: 'ADMIN_SERVICE', useValue: adminClient },
      ],
    }).compile();

    service = module.get(EventLifecycleService);
  });

  it('transitionne les événements PUBLISHED terminés vers TERMINATED', async () => {
    await service.run();

    expect(queryBuilder.where).toHaveBeenCalledWith('status = :status', { status: 'PUBLISHED' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('end_date <= :now', expect.any(Object));
  });

  it("utilise le délai d'archivage configuré par l'admin, pas une valeur figée dans le code", async () => {
    platformConfig.get.mockResolvedValue({ event_archive_delay_days: 7 });

    await service.run();

    const archiveCall = queryBuilder.andWhere.mock.calls.find((call) => call[0] === 'terminated_at <= :cutoff');
    expect(archiveCall).toBeDefined();
    const cutoff = archiveCall![1].cutoff as Date;
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
  });

  it('envoie une alerte admin pour un événement en retard non encore signalé', async () => {
    eventService.listPending.mockResolvedValue([
      { id: 'evt-1', title: 'Concert Test', is_overdue: true, deadline_alert_sent: false, validation_requested_at: new Date() },
    ]);

    await service.run();

    expect(adminClient.send).toHaveBeenCalledWith(
      'admin.log_action',
      expect.objectContaining({ entity_type: 'EVENT', entity_id: 'evt-1' }),
    );
    expect(repo.update).toHaveBeenCalledWith('evt-1', { deadline_alert_sent: true });
  });

  it("n'alerte pas deux fois le même événement (deadline_alert_sent déjà à true)", async () => {
    eventService.listPending.mockResolvedValue([
      { id: 'evt-1', is_overdue: true, deadline_alert_sent: true, validation_requested_at: new Date() },
    ]);

    await service.run();

    expect(adminClient.send).not.toHaveBeenCalled();
  });

  it("n'alerte pas un événement encore dans les délais", async () => {
    eventService.listPending.mockResolvedValue([
      { id: 'evt-1', is_overdue: false, deadline_alert_sent: false, validation_requested_at: new Date() },
    ]);

    await service.run();

    expect(adminClient.send).not.toHaveBeenCalled();
  });
});
