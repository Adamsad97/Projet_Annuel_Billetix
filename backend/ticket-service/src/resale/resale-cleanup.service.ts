import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketResaleService } from './ticket-resale.service';

@Injectable()
export class ResaleCleanupService {
  private readonly logger = new Logger(ResaleCleanupService.name);

  constructor(private readonly resaleService: TicketResaleService) {}

  // Fréquence de vérification — pas un paramètre métier, cf. délai
  // configurable resale_reservation_minutes qui, lui, l'est.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseStaleReservations(): Promise<void> {
    await this.resaleService.releaseStaleReservations();
  }

  // Événements passés sans acheteur — remet le statut à EXPIRED.
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldListings(): Promise<void> {
    await this.resaleService.expireOldListings();
  }
}
