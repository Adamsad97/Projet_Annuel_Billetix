import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../order/order.entity';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
  ) {}

  // Tous les jours à 9h00 UTC
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDayBeforeReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    const ordersToRemind = await this.orderRepo.find({
      where: {
        event_start_at: Between(tomorrowStart, tomorrowEnd),
        status: In([OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT]),
      },
    });

    this.logger.log(`Rappel J-1 : ${ordersToRemind.length} commande(s) concernée(s)`);

    for (const order of ordersToRemind) {
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
  }
}
