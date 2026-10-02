import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { JobLock } from '../scheduler/job-lock.service';
import { QrDisplayCode } from './qr-display-code.entity';

/** Efface les codes d'affichage expirés après le délai de synchronisation hors ligne. */
@Injectable()
export class QrDisplayCodeCleanupService {
  private readonly logger = new Logger(QrDisplayCodeCleanupService.name);

  constructor(
    @InjectRepository(QrDisplayCode) private readonly repo: Repository<QrDisplayCode>,
    private readonly config: ConfigService,
    private readonly jobLock: JobLock,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredJob(): Promise<void> {
    await this.jobLock.runOncePerPeriod('purge-expired-qr-display-codes', 3600, () => this.purgeExpired());
  }

  async purgeExpired(): Promise<void> {
    const retentionHours = Number(this.config.get('OFFLINE_SYNC_MAX_HOURS', 4));
    const before = new Date(Date.now() - retentionHours * 3600_000);
    const { affected } = await this.repo.delete({ valid_until: LessThan(before) });
    if (affected) this.logger.log(`${affected} code(s) QR expiré(s) supprimé(s)`);
  }
}
