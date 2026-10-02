import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobLock } from '../scheduler/job-lock.service';
import { TicketResaleService } from './ticket-resale.service';

@Injectable()
export class ResaleCleanupService {
  private readonly logger = new Logger(ResaleCleanupService.name);

  constructor(
    private readonly resaleService: TicketResaleService,
    private readonly jobLock: JobLock,
  ) {}

  // Fréquence de vérification — pas un paramètre métier, cf. délai
  // configurable resale_reservation_minutes qui, lui, l'est.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseStaleReservations(): Promise<void> {
    await this.jobLock.runOncePerPeriod('release-stale-resale-reservations', 5 * 60, () =>
      this.resaleService.releaseStaleReservations(),
    );
  }

  // Événements passés sans acheteur — remet le statut à EXPIRED.
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldListings(): Promise<void> {
    await this.jobLock.runOncePerPeriod('expire-old-resale-listings', 3600, () => this.resaleService.expireOldListings());
  }
}
