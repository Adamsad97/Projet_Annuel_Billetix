import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  async send(opts: SendMailOptions): Promise<void> {
    const context = { ...opts.context, year: new Date().getFullYear() };
    try {
      await this.mailer.sendMail({
        to: opts.to,
        subject: opts.subject,
        template: opts.template,
        context,
      });
      this.logger.log(`Email [${opts.template}] envoyé à ${opts.to}`);
    } catch (err) {
      this.logger.error(`Échec envoi email [${opts.template}] à ${opts.to} : ${err?.message}`);
    }
  }
}
