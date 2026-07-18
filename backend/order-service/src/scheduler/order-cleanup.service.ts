import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from '../order/order.service';

@Injectable()
export class OrderCleanupService {
  private readonly logger = new Logger(OrderCleanupService.name);

  constructor(private readonly orderService: OrderService) {}

  // Fréquence de vérification — pas un paramètre métier, cf. délai
  // configurable order_abandon_timeout_minutes qui, lui, l'est.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async releaseAbandonedOrders(): Promise<void> {
    const count = await this.orderService.releaseAbandoned();
    if (count > 0) {
      this.logger.log(`${count} commande(s) abandonnée(s) annulée(s), stock libéré`);
    }
  }
}
