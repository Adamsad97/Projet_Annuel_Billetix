import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Between, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../order/order.entity';
import { JobLock } from './job-lock.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
    private readonly jobLock: JobLock,
  ) {}

  /** Échec de lecture des préférences : on envoie quand même le rappel (fail-open). */
  private async wantsEventReminder(buyerId: string): Promise<boolean> {
    try {
      const prefs = await firstValueFrom(
        this.userClient.send<Record<string, boolean>>('user.get_notification_prefs', {
          user_id: buyerId,
        }),
      );
      return prefs['event-reminder'] !== false;
    } catch (error) {
      this.logger.warn(
        `Préférences de notification illisibles pour ${buyerId}, envoi du rappel par défaut : ${error?.message}`,
      );
      return true;
    }
  }

  // Tous les jours à 9h00 UTC
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDayBeforeRemindersJob(): Promise<void> {
    await this.jobLock.runOncePerPeriod('day-before-reminders', 24 * 3600, () => this.sendDayBeforeReminders());
  }

  async sendDayBeforeReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    // reminder_sent évite un double envoi, et un acheteur ne reçoit qu'un rappel par événement.
    const ordersToRemind = await this.orderRepo.find({
      where: {
        event_start_at: Between(tomorrowStart, tomorrowEnd),
        status: In([OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT]),
        reminder_sent: false,
      },
    });

    this.logger.log(`Rappel J-1 : ${ordersToRemind.length} commande(s) concernée(s)`);

    const remindedBuyersByEvent = new Set<string>();
    for (const order of ordersToRemind) {
      const dedupeKey = `${order.event_id}:${order.buyer_email}`;
      if (!remindedBuyersByEvent.has(dedupeKey)) {
        remindedBuyersByEvent.add(dedupeKey);
        if (!(await this.wantsEventReminder(order.buyer_id))) {
          order.reminder_sent = true;
          continue;
        }
        const eventDate = new Date(order.event_start_at);
        this.notifClient.emit('notification.event_reminder', {
          email: order.buyer_email,
          firstName: order.buyer_first_name,
          eventName: order.event_name,
          eventDate: eventDate.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          }),
          eventTime: eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          eventVenue: order.event_venue_name,
          eventAddress: order.event_venue_address,
        });
      }
      order.reminder_sent = true;
    }
    if (ordersToRemind.length > 0) {
      await this.orderRepo.save(ordersToRemind);
    }
  }
}
