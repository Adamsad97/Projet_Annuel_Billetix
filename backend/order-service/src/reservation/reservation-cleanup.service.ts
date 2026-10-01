import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StockReservationService } from './stock-reservation.service';

/** Restaure le quota des réservations de stock jamais devenues une commande. */
@Injectable()
export class ReservationCleanupService {
  private readonly logger = new Logger(ReservationCleanupService.name);

  constructor(private readonly reservationService: StockReservationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async restoreExpiredReservations(): Promise<void> {
    const count = await this.reservationService.restoreExpiredReservations();
    if (count > 0) {
      this.logger.log(`${count} réservation(s) expirée(s) — quota restauré`);
    }
  }
}
