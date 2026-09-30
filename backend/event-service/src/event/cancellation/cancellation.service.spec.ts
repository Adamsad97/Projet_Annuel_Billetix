import { RpcException } from '@nestjs/microservices';
import { EventStatus } from '../event.entity';
import { CancellationMessageAuthor } from './cancellation-message.entity';
import { CancellationRequestStatus, ChangeRequestKind } from './cancellation-request.entity';
import { CancellationService } from './cancellation.service';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';

describe('CancellationService — demandes d\'annulation', () => {
  let requests: Record<string, jest.Mock>;
  let messages: Record<string, jest.Mock>;
  let eventService: {
    getById: jest.Mock;
    cancel: jest.Mock;
    postpone: jest.Mock;
    assertPostponable: jest.Mock;
    parseNewDates: jest.Mock;
  };
  let service: CancellationService;
  let update: jest.Mock;

  const pending = () => ({
    id: REQUEST_ID,
    event_id: EVENT_ID,
    organizer_id: 'organizer-1',
    reason: 'Artiste malade',
    status: CancellationRequestStatus.PENDING,
    messages: [],
  });

  beforeEach(() => {
    requests = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (value) => ({ id: REQUEST_ID, ...value })),
      create: jest.fn((value) => value),
      count: jest.fn(),
      findAndCount: jest.fn(),
    };
    messages = { save: jest.fn(async (value) => value), create: jest.fn((value) => value) };
    eventService = {
      getById: jest.fn(),
      cancel: jest.fn(async () => ({ id: EVENT_ID, status: EventStatus.CANCELLED })),
      postpone: jest.fn(async () => ({ id: EVENT_ID, status: EventStatus.POSTPONED })),
      assertPostponable: jest.fn(),
      parseNewDates: jest.fn(() => null),
    };
    update = jest.fn();
    const dataSource = {
      transaction: jest.fn(async (work) => work({ save: jest.fn(), create: jest.fn((_e, v) => v), update })),
    };
    service = new CancellationService(
      requests as never,
      messages as never,
      {} as never,
      eventService as never,
      dataSource as never,
    );
  });

  it('refuse la demande d\'un organisateur qui ne possède pas l\'événement', async () => {
    eventService.getById.mockResolvedValue({ id: EVENT_ID, organizer_id: 'autre', status: EventStatus.PUBLISHED });
    await expect(service.request(EVENT_ID, 'organizer-1', 'Motif')).rejects.toBeInstanceOf(RpcException);
  });

  it('exige un motif', async () => {
    eventService.getById.mockResolvedValue({ id: EVENT_ID, organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });
    await expect(service.request(EVENT_ID, 'organizer-1', '   ')).rejects.toBeInstanceOf(RpcException);
  });

  it('refuse une seconde demande tant que la première est en attente', async () => {
    eventService.getById.mockResolvedValue({ id: EVENT_ID, organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });
    requests.findOne.mockResolvedValueOnce(pending());
    await expect(service.request(EVENT_ID, 'organizer-1', 'Motif')).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 409 }),
    });
  });

  it('crée la demande sans annuler l\'événement', async () => {
    eventService.getById.mockResolvedValue({ id: EVENT_ID, organizer_id: 'organizer-1', status: EventStatus.PUBLISHED });
    requests.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(pending());
    const result = await service.request(EVENT_ID, 'organizer-1', ' Artiste malade ');
    expect(requests.save).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Artiste malade' }));
    expect(eventService.cancel).not.toHaveBeenCalled();
    expect(result.status).toBe(CancellationRequestStatus.PENDING);
  });

  it('empêche un organisateur d\'écrire sur la demande d\'un autre', async () => {
    requests.findOne.mockResolvedValue(pending());
    await expect(
      service.addMessage(REQUEST_ID, 'intrus', CancellationMessageAuthor.ORGANIZER, 'Bonjour'),
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('le refus exige un message et ne touche pas à l\'événement', async () => {
    requests.findOne.mockResolvedValue(pending());
    await expect(service.reject(REQUEST_ID, 'admin-1', '')).rejects.toBeInstanceOf(RpcException);
    await service.reject(REQUEST_ID, 'admin-1', 'Proposez plutôt un report');
    expect(eventService.cancel).not.toHaveBeenCalled();
  });

  it('l\'acceptation annule l\'événement avec le motif de la demande', async () => {
    requests.findOne.mockResolvedValue(pending());
    eventService.getById.mockResolvedValue({ id: EVENT_ID, status: EventStatus.PUBLISHED, start_date: new Date('2030-01-01') });
    await service.approve(REQUEST_ID, 'admin-1', undefined);
    expect(eventService.cancel).toHaveBeenCalledWith(EVENT_ID, 'admin-1', { reason: 'Artiste malade' }, true);
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      REQUEST_ID,
      expect.objectContaining({ status: CancellationRequestStatus.APPROVED }),
    );
  });

  it('une demande déjà traitée ne peut plus être acceptée', async () => {
    requests.findOne.mockResolvedValue({ ...pending(), status: CancellationRequestStatus.REJECTED });
    await expect(service.approve(REQUEST_ID, 'admin-1', undefined)).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 409 }),
    });
  });

  describe('report', () => {
    const owned = { id: EVENT_ID, organizer_id: 'organizer-1', status: EventStatus.PUBLISHED, start_date: new Date('2030-01-01') };

    it('crée une demande de report avec la nouvelle date proposée', async () => {
      eventService.getById.mockResolvedValue(owned);
      const start = new Date('2030-02-01T20:00:00Z');
      const end = new Date('2030-02-01T23:00:00Z');
      eventService.parseNewDates.mockReturnValue({ start, end });
      requests.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(pending());
      await service.request(EVENT_ID, 'organizer-1', 'Salle indisponible', {
        kind: ChangeRequestKind.POSTPONEMENT,
        new_start_date: start.toISOString(),
        new_end_date: end.toISOString(),
      });
      expect(eventService.assertPostponable).toHaveBeenCalledWith(owned);
      expect(requests.save).toHaveBeenCalledWith(
        expect.objectContaining({ kind: ChangeRequestKind.POSTPONEMENT, new_start_date: start, new_end_date: end }),
      );
      expect(eventService.postpone).not.toHaveBeenCalled();
    });

    it('accepte un report sans date : « date à venir »', async () => {
      eventService.getById.mockResolvedValue(owned);
      requests.findOne.mockResolvedValue({ ...pending(), kind: ChangeRequestKind.POSTPONEMENT, new_start_date: null, new_end_date: null });
      const result = await service.approve(REQUEST_ID, 'admin-1', undefined);
      expect(eventService.postpone).toHaveBeenCalledWith(EVENT_ID, 'Artiste malade', null);
      expect(eventService.cancel).not.toHaveBeenCalled();
      expect(result.previous_start_date).toEqual(owned.start_date);
      expect(update).toHaveBeenCalledWith(expect.anything(), REQUEST_ID, expect.objectContaining({ status: CancellationRequestStatus.APPROVED }));
    });

    it('accepte un report avec nouvelle date : dates transmises', async () => {
      eventService.getById.mockResolvedValue(owned);
      const start = new Date('2030-02-01T20:00:00Z');
      const end = new Date('2030-02-01T23:00:00Z');
      requests.findOne.mockResolvedValue({ ...pending(), kind: ChangeRequestKind.POSTPONEMENT, new_start_date: start, new_end_date: end });
      await service.approve(REQUEST_ID, 'admin-1', undefined);
      expect(eventService.postpone).toHaveBeenCalledWith(EVENT_ID, 'Artiste malade', { start, end });
    });
  });
});
