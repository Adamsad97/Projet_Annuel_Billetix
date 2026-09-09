import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { Order } from '../order/order.entity';
import { ReminderService } from './reminder.service';

describe('ReminderService — rappel J-1', () => {
  let service: ReminderService;
  let orderRepo: { find: jest.Mock; save: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let userClient: { send: jest.Mock };

  beforeEach(async () => {
    orderRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue(undefined) };
    notifClient = { emit: jest.fn() };
    // Par défaut : aucune préférence enregistrée -> envoi (fail-open, voir wantsEventReminder).
    userClient = { send: jest.fn().mockReturnValue(of({})) };

    const module = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: 'NOTIFICATION_SERVICE', useValue: notifClient },
        { provide: 'USER_SERVICE', useValue: userClient },
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
      { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ]);

    await service.sendDayBeforeReminders();

    expect(notifClient.emit).toHaveBeenCalledTimes(1);
  });

  it('marque toutes les commandes concernées comme rappelées, même celles dédoublonnées', async () => {
    const orders = [
      { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ];
    orderRepo.find.mockResolvedValue(orders);

    await service.sendDayBeforeReminders();

    expect(orders.every((o) => o.reminder_sent === true)).toBe(true);
    expect(orderRepo.save).toHaveBeenCalledWith(orders);
  });

  it('envoie un rappel distinct par acheteur différent', async () => {
    orderRepo.find.mockResolvedValue([
      { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      { id: 'o2', event_id: 'evt-1', buyer_id: 'buyer-B', buyer_email: 'b@test.com', buyer_first_name: 'B', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
    ]);

    await service.sendDayBeforeReminders();

    expect(notifClient.emit).toHaveBeenCalledTimes(2);
  });

  it("n'appelle pas save() si aucune commande à rappeler", async () => {
    orderRepo.find.mockResolvedValue([]);

    await service.sendDayBeforeReminders();

    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  describe('préférences de notification (niveau 2)', () => {
    it("n'envoie pas le rappel si l'acheteur a explicitement désactivé event-reminder", async () => {
      const order = { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false };
      orderRepo.find.mockResolvedValue([order]);
      userClient.send.mockReturnValue(of({ 'event-reminder': false }));

      await service.sendDayBeforeReminders();

      expect(notifClient.emit).not.toHaveBeenCalled();
      expect(userClient.send).toHaveBeenCalledWith('user.get_notification_prefs', { user_id: 'buyer-A' });
      // Marqué rappelé quand même — pas de nouvelle tentative demain.
      expect(order.reminder_sent).toBe(true);
    });

    it('envoie le rappel si la préférence est explicitement activée', async () => {
      orderRepo.find.mockResolvedValue([
        { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      ]);
      userClient.send.mockReturnValue(of({ 'event-reminder': true }));

      await service.sendDayBeforeReminders();

      expect(notifClient.emit).toHaveBeenCalledTimes(1);
    });

    it("envoie le rappel par défaut (fail-open) si les préférences sont illisibles", async () => {
      orderRepo.find.mockResolvedValue([
        { id: 'o1', event_id: 'evt-1', buyer_id: 'buyer-A', buyer_email: 'a@test.com', buyer_first_name: 'A', event_name: 'Concert', event_start_at: new Date(), event_venue_name: 'Salle', event_venue_address: '1 rue', reminder_sent: false },
      ]);
      userClient.send.mockReturnValue(throwError(() => new Error('user-service injoignable')));

      await service.sendDayBeforeReminders();

      expect(notifClient.emit).toHaveBeenCalledTimes(1);
    });
  });
});
