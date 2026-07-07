import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventService } from '../event/event.service';
import { Event, EventStatus } from '../event/event.entity';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';

@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);

  constructor(
    @InjectRepository(Event) private readonly repo: Repository<Event>,
    private readonly eventService: EventService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.terminatePastEvents();
    await this.archiveOldTerminatedEvents();
    await this.alertOverdueValidations();
  }

  /** PUBLISHED → TERMINATED dès que la date de fin est passée (CDC section 3.3). */
  private async terminatePastEvents(): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.TERMINATED, terminated_at: new Date() })
      .where('status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('end_date <= :now', { now: new Date() })
      .execute();
    if (result.affected) {
      this.logger.log(`${result.affected} événement(s) passé(s) en TERMINATED`);
    }
  }

  /** TERMINATED → ARCHIVED après le délai configuré par l'admin. */
  private async archiveOldTerminatedEvents(): Promise<void> {
    const config = await this.platformConfig.get();
    const cutoff = new Date(Date.now() - config.event_archive_delay_days * 24 * 60 * 60 * 1000);

    const result = await this.repo
      .createQueryBuilder()
      .update(Event)
      .set({ status: EventStatus.ARCHIVED, archived_at: new Date() })
      .where('status = :status', { status: EventStatus.TERMINATED })
      .andWhere('terminated_at <= :cutoff', { cutoff })
      .execute();
    if (result.affected) {
      this.logger.log(`${result.affected} événement(s) archivé(s)`);
    }
  }

  /**
   * Alerte admin réelle (journal d'audit) quand le délai de traitement d'un
   * événement en attente de validation est dépassé — une seule fois par
   * événement (deadline_alert_sent), remis à zéro à chaque nouvelle
   * soumission ou réponse à une demande de complément d'info.
   */
  private async alertOverdueValidations(): Promise<void> {
    const pending = await this.eventService.listPending();
    const overdue = pending.filter((event) => event.is_overdue && !event.deadline_alert_sent);

    for (const event of overdue) {
      this.adminClient
        .send('admin.log_action', {
          action: 'CUSTOM',
          entity_type: 'EVENT',
          entity_id: event.id,
          performed_by: 'system',
          performed_by_email: 'system@billetix.internal',
          reason: `Délai de traitement dépassé pour l'événement "${event.title}" (soumis le ${event.validation_requested_at?.toISOString()})`,
          metadata: { event_id: event.id, validation_deadline: event.validation_deadline },
          ip_address: '',
        })
        .subscribe({
          error: (err) => this.logger.error(`Échec de l'alerte admin : ${err?.message}`),
        });

      await this.repo.update(event.id, { deadline_alert_sent: true });
    }

    if (overdue.length) {
      this.logger.warn(`${overdue.length} événement(s) en dépassement du délai de traitement`);
    }
  }
}
