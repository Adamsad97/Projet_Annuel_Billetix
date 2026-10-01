import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { PayoutService } from '../payout/payout.service';
import { PayoutStatus } from '../payout/payout.entity';

interface PayoutAccount {
  payout_method: 'BANK_TRANSFER' | 'STRIPE';
  has_iban: boolean;
  iban_updated_at: string | null;
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
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  // Tous les jours à 10h00 UTC — déclenche les reversements arrivés à échéance
  // (scheduled_at = date de fin d'événement + payout_delay_days, cf. platform-config)
  @Cron('0 10 * * *')
  async processDuePayouts(): Promise<void> {
    const duePayouts = await this.payoutService.getDuePayouts();
    if (duePayouts.length === 0) return;

    this.logger.log(`Reversements à échéance : ${duePayouts.length}`);
    const config = await this.platformConfig.get();
    // Reversements passés « À virer » pendant ce cycle : un seul email aux admins.
    let preparedCount = 0;

    // État réel des événements lu à chaque cycle : jamais de reversement d'un événement reporté.
    const events = new Map<string, { status?: string; end_date?: string } | null>();
    for (const payout of duePayouts) {
      try {
        if (!events.has(payout.event_id)) {
          const event = await firstValueFrom(
            this.eventClient.send<{ status?: string; end_date?: string }>('event.get', { id: payout.event_id }),
          ).catch(() => null);
          events.set(payout.event_id, event);
        }
        const event = events.get(payout.event_id);
        if (!event) {
          this.logger.warn(`Reversement ${payout.id} différé : événement ${payout.event_id} injoignable`);
          continue;
        }
        if (event.status === 'POSTPONED') {
          await this.payoutService.holdForEvent(payout.event_id);
          this.logger.warn(`Reversement ${payout.id} suspendu : événement ${payout.event_id} reporté`);
          continue;
        }
        if (
          event.end_date &&
          payout.event_end_at &&
          new Date(event.end_date).getTime() > new Date(payout.event_end_at).getTime()
        ) {
          await this.payoutService.rescheduleForEvent(payout.event_id, new Date(event.end_date));
          this.logger.warn(`Reversement ${payout.id} reprogrammé : l'événement ${payout.event_id} a changé de date`);
          continue;
        }

        const account = await firstValueFrom(
          this.userClient.send<PayoutAccount>('user.get_payout_account', {
            user_id: payout.organizer_id,
          }),
        );

        if (account?.kyc_status !== 'VERIFIED') {
          this.logger.warn(
            `Reversement ${payout.id} suspendu : KYC non validé (organisateur ${payout.organizer_id})`,
          );
          continue;
        }

        if (account.payout_method === 'BANK_TRANSFER') {
          if (!account.has_iban) {
            this.logger.warn(`Reversement ${payout.id} suspendu : aucun IBAN (organisateur ${payout.organizer_id})`);
            continue;
          }
          // IBAN modifié récemment : on laisse à l'organisateur le temps de
          // réagir à l'email d'alerte avant tout virement vers ce compte.
          const holdUntil = account.iban_updated_at
            ? new Date(account.iban_updated_at).getTime() + config.iban_change_payout_hold_hours * 3_600_000
            : 0;
          if (holdUntil > Date.now()) {
            this.logger.warn(`Reversement ${payout.id} suspendu : IBAN modifié récemment (organisateur ${payout.organizer_id})`);
            continue;
          }
          const prepared = await this.payoutService.prepareBankTransfer(payout.id);
          if (prepared.status === PayoutStatus.TO_TRANSFER) preparedCount += 1;
          this.logger.log(`Reversement ${payout.id} : ${prepared.status === PayoutStatus.TO_TRANSFER ? 'à virer' : 'soldé par compensation'}`);
          continue;
        }

        if (!account.stripe_connect_account_id || !account.stripe_connect_onboarded) {
          this.logger.warn(
            `Reversement ${payout.id} suspendu : compte Stripe Connect non configuré (organisateur ${payout.organizer_id})`,
          );
          continue;
        }

        const processed = await this.payoutService.process(payout.id, account.stripe_connect_account_id);

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
        ).catch((notificationError) =>
          this.logger.error(`Échec notification reversement ${processed.id} : ${notificationError?.message}`),
        );
      } catch (error) {
        this.logger.error(`Échec du traitement du reversement ${payout.id} : ${error?.message}`);
      }
    }

    if (preparedCount > 0) {
      this.notifyAdminsToTransfer(preparedCount).catch((error) =>
        this.logger.error(`Alerte « virements à effectuer » non envoyée : ${error?.message}`),
      );
    }
  }

  /** Récapitulatif des virements à émettre envoyé à chaque admin actif. */
  private async notifyAdminsToTransfer(newCount: number): Promise<void> {
    const pending = await this.payoutService.getToTransfer();
    const total = pending.reduce((sum, payout) => sum + Number(payout.net_amount) - Number(payout.offset_amount), 0);
    const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    const pages = await Promise.all(
      (['ADMIN', 'SUPER_ADMIN'] as const).map((role) =>
        firstValueFrom(
          this.authClient.send<{ data: Array<{ email: string; first_name: string }> }>('auth.list_users', {
            role,
            status: 'active',
            limit: 100,
          }),
        ),
      ),
    );
    const admins = new Map(pages.flatMap((page) => page.data).map((admin) => [admin.email.toLowerCase(), admin]));
    const plural = newCount > 1;
    for (const admin of admins.values()) {
      this.notificationClient.emit('notification.admin_notice', {
        email: admin.email,
        firstName: admin.first_name,
        subject: `${newCount} reversement${plural ? 's' : ''} à virer`,
        headline: 'Virements à effectuer',
        intro: `${newCount} reversement${plural ? 's sont passés' : ' est passé'} « À virer » aujourd'hui. Téléchargez le fichier de virements SEPA, importez-le dans la banque de la plateforme, puis marquez les virements comme versés.`,
        details: [
          `Reversements en attente de virement : ${pending.length}`,
          `Montant total à virer : ${euros.format(total)}`,
        ],
        ctaLabel: 'Ouvrir les reversements',
        ctaPath: '/admin/reversements',
      });
    }
  }

  // Tous les jours à 10h30 UTC : débloque les reversements bloqués pour litige au-delà du délai maximum.
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
      } catch (error) {
        this.logger.error(`Échec du déblocage automatique du reversement ${payout.id} : ${error?.message}`);
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

    this.notificationClient.emit('notification.payout_completed', {
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
