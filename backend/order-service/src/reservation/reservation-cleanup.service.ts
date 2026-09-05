import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StockReservationService } from './stock-reservation.service';

/**
 * Bug corrigé : une réservation de stock (order.reserve_stock) qui n'aboutit
 * jamais à une commande — client parti sans payer — décrémentait le quota
 * sans jamais le restaurer. La clé Redis expirait simplement, sans laisser
 * de trace exploitable pour rendre les places au catalogue.
 */
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
