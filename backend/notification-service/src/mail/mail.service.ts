import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MailerService } from '@nestjs-modules/mailer';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
  attachments?: MailAttachment[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerService,
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async send(opts: SendMailOptions): Promise<void> {
    const context = { ...opts.context, year: new Date().getFullYear() };
    const config = await this.platformConfig.get();
    const maxAttempts = config.email_max_retry_attempts;
    const retryDelayMs = config.email_retry_delay_minutes * 60 * 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.mailer.sendMail({
          to: opts.to,
          subject: opts.subject,
          template: opts.template,
          context,
          attachments: opts.attachments,
        });
        this.logger.log(`Email [${opts.template}] envoyé à ${opts.to} (tentative ${attempt})`);
        return;
      } catch (err) {
        this.logger.warn(
          `Échec envoi email [${opts.template}] à ${opts.to} — tentative ${attempt}/${maxAttempts} : ${err?.message}`,
        );
        if (attempt < maxAttempts) {
          await this.sleep(retryDelayMs);
        }
      }
    }

    this.logger.error(
      `Email [${opts.template}] à ${opts.to} définitivement échoué après ${maxAttempts} tentatives`,
    );

    // Alerte admin réelle (journal d'audit consultable via GET /admin/audit-logs),
    // pas seulement une ligne de log qui disparaît dans les conteneurs — fire-and-forget,
    // ne doit jamais faire planter le flux appelant si admin-service est indisponible.
    this.adminClient
      .send('admin.log_action', {
        action: 'CUSTOM',
        // AuditEntityType n'a pas de valeur NOTIFICATION — USER est le plus
        // proche (le destinataire de l'email), le détail réel est dans metadata.
        entity_type: 'USER',
        entity_id: null,
        performed_by: 'system',
        performed_by_email: 'system@billetix.internal',
        reason: `Échec définitif d'envoi email [${opts.template}] à ${opts.to} après ${maxAttempts} tentatives`,
        metadata: { template: opts.template, to: opts.to },
        ip_address: '',
      })
      .subscribe({
        error: (err) =>
          this.logger.error(`Échec de l'alerte admin elle-même : ${err?.message}`),
      });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
