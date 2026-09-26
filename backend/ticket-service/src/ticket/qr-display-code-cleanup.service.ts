import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { QrDisplayCode } from './qr-display-code.entity';

/**
 * Efface les codes d'affichage expirés une fois passé le délai de
 * synchronisation des scans hors ligne (OFFLINE_SYNC_MAX_HOURS) — au-delà,
 * plus aucun scan ne peut légitimement les présenter.
 */
@Injectable()
export class QrDisplayCodeCleanupService {
  private readonly logger = new Logger(QrDisplayCodeCleanupService.name);

  constructor(
    @InjectRepository(QrDisplayCode) private readonly repo: Repository<QrDisplayCode>,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    const retentionHours = Number(this.config.get('OFFLINE_SYNC_MAX_HOURS', 4));
    const before = new Date(Date.now() - retentionHours * 3600_000);
    const { affected } = await this.repo.delete({ valid_until: LessThan(before) });
    if (affected) this.logger.log(`${affected} code(s) QR expiré(s) supprimé(s)`);
  }
}
