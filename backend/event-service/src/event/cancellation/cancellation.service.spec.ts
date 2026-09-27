import { RpcException } from '@nestjs/microservices';
import { EventStatus } from '../event.entity';
import { CancellationMessageAuthor } from './cancellation-message.entity';
import { CancellationRequestStatus } from './cancellation-request.entity';
import { CancellationService } from './cancellation.service';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';

describe('CancellationService — demandes d\'annulation', () => {
  let requests: Record<string, jest.Mock>;
  let messages: Record<string, jest.Mock>;
  let eventService: { getById: jest.Mock; cancel: jest.Mock };
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
    eventService = { getById: jest.fn(), cancel: jest.fn(async () => ({ id: EVENT_ID, status: EventStatus.CANCELLED })) };
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
});
