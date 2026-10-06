import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order/order.service';
import { JobLock } from './job-lock.service';

@Injectable()
export class OrderCleanupService {
  private readonly logger = new Logger(OrderCleanupService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly jobLock: JobLock,
  ) {}

  // Fréquence de vérification — pas un paramètre métier : chaque minute, pour remettre
  // en vente les places d'une commande non payée peu après son échéance.
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseAbandonedOrdersJob(): Promise<void> {
    await this.jobLock.runOncePerPeriod('release-abandoned-orders', 60, () => this.releaseAbandonedOrders());
  }

  async releaseAbandonedOrders(): Promise<void> {
    const count = await this.orderService.releaseAbandoned();
    if (count > 0) {
      this.logger.log(`${count} commande(s) abandonnée(s) annulée(s), stock libéré`);
    }
  }
}
