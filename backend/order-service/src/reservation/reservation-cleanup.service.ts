import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobLock } from '../scheduler/job-lock.service';
import { StockReservationService } from './stock-reservation.service';

/** Restaure le quota des réservations de stock jamais devenues une commande. */
@Injectable()
export class ReservationCleanupService {
  private readonly logger = new Logger(ReservationCleanupService.name);

  constructor(
    private readonly reservationService: StockReservationService,
    private readonly jobLock: JobLock,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async restoreExpiredReservationsJob(): Promise<void> {
    await this.jobLock.runOncePerPeriod('restore-expired-reservations', 60, () => this.restoreExpiredReservations());
  }

  async restoreExpiredReservations(): Promise<void> {
    const count = await this.reservationService.restoreExpiredReservations();
    if (count > 0) {
      this.logger.log(`${count} réservation(s) expirée(s) — quota restauré`);
    }
  }
}
