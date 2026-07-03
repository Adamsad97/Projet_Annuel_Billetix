import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // ms

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  async send(opts: SendMailOptions): Promise<void> {
    const context = { ...opts.context, year: new Date().getFullYear() };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.mailer.sendMail({
          to: opts.to,
          subject: opts.subject,
          template: opts.template,
          context,
        });
        this.logger.log(`Email [${opts.template}] envoyé à ${opts.to} (tentative ${attempt})`);
        return;
      } catch (err) {
        this.logger.warn(
          `Échec envoi email [${opts.template}] à ${opts.to} — tentative ${attempt}/${MAX_ATTEMPTS} : ${err?.message}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(RETRY_DELAYS[attempt - 1]);
        }
      }
    }

    this.logger.error(
      `Email [${opts.template}] à ${opts.to} définitivement échoué après ${MAX_ATTEMPTS} tentatives`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
