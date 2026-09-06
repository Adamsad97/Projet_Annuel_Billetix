import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { ReminderService } from './reminder.service';

describe('ReminderService — rappel J-1', () => {
  let service: ReminderService;
  let orderRepo: { find: jest.Mock; save: jest.Mock };
  let notifClient: { emit: jest.Mock };

  beforeEach(async () => {
    orderRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue(undefined) };
    notifClient = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
      ],
    }).compile();

    service = module.get(ReminderService);
  });

  it('ne consulte que les commandes pas encore rappelées (reminder_sent: false)', async () => {
    await service.sendDayBeforeReminders();

    const whereClause = orderRepo.find.mock.calls[0][0].where;
    expect(whereClause.reminder_sent).toBe(false);
  });

  it('envoie un seul rappel par acheteur pour un même événement (dédoublonnage)', async () => {
    orderRepo.find.mockResolvedValue([
      { id: 'o1', event_id: 'evt-1', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ]);

    await service.sendDayBeforeReminders();

    expect(notifClient.emit).toHaveBeenCalledTimes(1);
  });

  it('marque toutes les commandes concernées comme rappelées, même celles dédoublonnées', async () => {
    const orders = [
      { id: 'o1', event_id: 'evt-1', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ];
    orderRepo.find.mockResolvedValue(orders);

    await service.sendDayBeforeReminders();

    expect(orders.every((o) => o.reminder_sent === true)).toBe(true);
    expect(orderRepo.save).toHaveBeenCalledWith(orders);
  });

  it('envoie un rappel distinct par acheteur différent', async () => {
    orderRepo.find.mockResolvedValue([
      { id: 'o1', event_id: 'evt-1', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_email: 'b@test.com', buyer_first_name: 'B', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ]);

    await service.sendDayBeforeReminders();

    expect(notifClient.emit).toHaveBeenCalledTimes(2);
  });

  it("n'appelle pas save() si aucune commande à rappeler", async () => {
    orderRepo.find.mockResolvedValue([]);

    await service.sendDayBeforeReminders();

    expect(orderRepo.save).not.toHaveBeenCalled();
  });
});
