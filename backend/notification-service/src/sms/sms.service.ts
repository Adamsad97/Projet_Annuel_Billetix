import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // ms

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: ReturnType<typeof Twilio> | null;
  private readonly fromNumber: string | undefined;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');

    this.client =
      accountSid && authToken ? Twilio(accountSid, authToken) : null;
  }

  async send(to: string, body: string): Promise<void> {
    if (!this.client || !this.fromNumber) {
      // Pas de Twilio configuré (dev local) — équivalent de MailHog pour les
      // emails : on journalise le code plutôt que d'échouer silencieusement.
      this.logger.warn(
        `[SMS non envoyé — Twilio non configuré] à ${to} : ${body}`,
      );
      return;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.client.messages.create({
          to,
          from: this.fromNumber,
          body,
        });
        this.logger.log(`SMS envoyé à ${to} (tentative ${attempt})`);
        return;
      } catch (err) {
        this.logger.warn(
          `Échec envoi SMS à ${to} — tentative ${attempt}/${MAX_ATTEMPTS} : ${err?.message}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(RETRY_DELAYS[attempt - 1]);
        }
      }
    }

    this.logger.error(
      `SMS à ${to} définitivement échoué après ${MAX_ATTEMPTS} tentatives`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
