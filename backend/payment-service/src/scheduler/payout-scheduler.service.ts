import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { PayoutService } from '../payout/payout.service';
import { PayoutStatus } from '../payout/payout.entity';

interface OrganizerProfile {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  kyc_status: string;
}

interface UserContact {
  email: string;
  first_name: string;
}

@Injectable()
export class PayoutSchedulerService {
  private readonly logger = new Logger(PayoutSchedulerService.name);

  constructor(
    private readonly payoutService: PayoutService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notifClient: ClientProxy,
  ) {}

  // Tous les jours à 10h00 UTC — déclenche les reversements arrivés à échéance
  // (scheduled_at = date de fin d'événement + payout_delay_days, cf. platform-config)
  @Cron('0 10 * * *')
  async processDuePayouts(): Promise<void> {
    const duePayouts = await this.payoutService.getDuePayouts();
    if (duePayouts.length === 0) return;

    this.logger.log(`Reversements à échéance : ${duePayouts.length}`);

    for (const payout of duePayouts) {
      try {
        const profile = await firstValueFrom(
          this.userClient.send<OrganizerProfile>('user.get_organizer_profile', {
            user_id: payout.organizer_id,
          }),
        );

        if (!profile?.stripe_connect_account_id || !profile.stripe_connect_onboarded) {
          this.logger.warn(
            `Reversement ${payout.id} suspendu : compte Stripe Connect non configuré (organisateur ${payout.organizer_id})`,
          );
          continue;
        }

        if (profile.kyc_status !== 'VERIFIED') {
          this.logger.warn(
            `Reversement ${payout.id} suspendu : KYC non validé (organisateur ${payout.organizer_id})`,
          );
          continue;
        }

        const processed = await this.payoutService.process(payout.id, profile.stripe_connect_account_id);

        if (processed.status !== PayoutStatus.COMPLETED) {
          this.logger.warn(`Reversement ${payout.id} en échec (virement Stripe refusé)`);
          continue;
        }

        this.logger.log(`Reversement ${payout.id} traité avec succès`);

        // Notification organisateur (CDC §9.2 : « Reversement effectué ») —
        // ne bloque jamais le traitement du reversement lui-même en cas d'échec.
        this.notifyPayoutCompleted(
          processed.organizer_id,
          processed.event_id,
          Number(processed.net_amount),
        ).catch((err) =>
          this.logger.error(`Échec notification reversement ${processed.id} : ${err?.message}`),
        );
      } catch (err) {
        this.logger.error(`Échec du traitement du reversement ${payout.id} : ${err?.message}`);
      }
    }
  }

  // Tous les jours à 10h30 UTC — un reversement bloqué pour litige ne doit
  // jamais rester bloqué indéfiniment (CDC §7.2 : « fonds bloqués jusqu'à
  // résolution, 30 jours maximum »). Débloque automatiquement ceux dont le
  // délai configuré (dispute_payout_block_max_days) est dépassé, résolu ou non.
  @Cron('30 10 * * *')
  async unblockExpiredDisputePayouts(): Promise<void> {
    const config = await this.platformConfig.get();
    const expired = await this.payoutService.getExpiredBlockedPayouts(
      config.dispute_payout_block_max_days,
    );
    if (expired.length === 0) return;

    this.logger.log(`Reversements bloqués à débloquer automatiquement (délai dépassé) : ${expired.length}`);

    for (const payout of expired) {
      try {
        await this.payoutService.unblock(payout.id);
        this.logger.warn(
          `Reversement ${payout.id} débloqué automatiquement après ${config.dispute_payout_block_max_days} jours de blocage`,
        );
      } catch (err) {
        this.logger.error(`Échec du déblocage automatique du reversement ${payout.id} : ${err?.message}`);
      }
    }
  }

  private async notifyPayoutCompleted(
    organizerId: string,
    eventId: string,
    netAmount: number,
  ): Promise<void> {
    const [contact, event] = await Promise.all([
      firstValueFrom(this.authClient.send<UserContact>('auth.get_user', { id: organizerId })),
      firstValueFrom(this.eventClient.send<{ title: string }>('event.get', { id: eventId })),
    ]);
    if (!contact?.email) return;

    this.notifClient.emit('notification.payout_completed', {
      email: contact.email,
      firstName: contact.first_name,
      eventName: event?.title ?? 'votre événement',
      amount: netAmount.toFixed(2),
      payoutDate: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });
  }
}
