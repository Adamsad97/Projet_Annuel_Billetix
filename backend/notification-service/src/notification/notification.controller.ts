import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { MailAttachment, MailService } from '../mail/mail.service';
import { AccountActivatedDto } from './dto/account-activated.dto';
import { AccountSuspendedDto } from './dto/account-suspended.dto';
import { AccountUnlockedDto } from './dto/account-unlocked.dto';
import { AccountUnsuspendedDto } from './dto/account-unsuspended.dto';
import { TwoFactorResetByAdminDto } from './dto/two-factor-reset-by-admin.dto';
import { EmailVerificationDto } from './dto/email-verification.dto';
import { EventCanceledDto } from './dto/event-canceled.dto';
import { EventInfoRequestedDto } from './dto/event-info-requested.dto';
import { EventRecommendationsDto } from './dto/event-recommendations.dto';
import { EventPublishedDto } from './dto/event-published.dto';
import { EventReminderDto } from './dto/event-reminder.dto';
import { EventRejectedDto } from './dto/event-rejected.dto';
import { EventSuspendedDto } from './dto/event-suspended.dto';
import { EventUpdatedDto } from './dto/event-updated.dto';
import { FirstSaleDto } from './dto/first-sale.dto';
import { DisputeOpenedDto } from './dto/dispute-opened.dto';
import { DisputeResolvedDto } from './dto/dispute-resolved.dto';
import { FillThresholdReachedDto } from './dto/fill-threshold-reached.dto';
import { PayoutCompletedDto } from './dto/payout-completed.dto';
import { RefundCompletedDto } from './dto/refund-completed.dto';
import { ResaleListedDto } from './dto/resale-listed.dto';
import { ResaleSoldDto } from './dto/resale-sold.dto';
import { ResaleWithdrawnDto } from './dto/resale-withdrawn.dto';
import { KycApprovedDto } from './dto/kyc-approved.dto';
import { KycRejectedDto } from './dto/kyc-rejected.dto';
import { NewsletterDto } from './dto/newsletter.dto';
import { OrderConfirmedDto } from './dto/order-confirmed.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { PaymentConfirmedDto } from './dto/payment-confirmed.dto';
import { PaymentFailedDto } from './dto/payment-failed.dto';
import { PurchaseInvoiceDto } from './dto/purchase-invoice.dto';
import { TicketReadyDto } from './dto/ticket-ready.dto';
import { TicketScannedDto } from './dto/ticket-scanned.dto';
import { TicketTransferredDto } from './dto/ticket-transferred.dto';
import { TransferRevertedDto, TransferRevertRejectedDto, TransferRevertRequestedDto } from './dto/transfer-revert.dto';
import { WelcomeDto } from './dto/welcome.dto';

@Controller()
export class NotificationController {
  private readonly appUrl: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    // FRONTEND_URL (pas APP_URL, qui vaut http://localhost:4000 côté
    // api-gateway pour les callbacks OAuth) — ces liens sont cliqués par
    // l'utilisateur dans son navigateur et doivent pointer vers le
    // frontend, jamais vers l'API. Bug corrigé : les emails (vérification,
    // reset mot de passe, etc.) pointaient vers le gateway et renvoyaient
    // un 404 une fois cliqués.
    this.appUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /**
   * Lien d'email vers une page sensible : passe par la connexion avec
   * reauth=1 — toute session déjà ouverte dans le navigateur est fermée et
   * l'utilisateur doit s'authentifier à chaque clic (demande produit, cf.
   * app/connexion), puis il est renvoyé vers `path`.
   */
  private reauthUrl(path: string): string {
    return `${this.appUrl}/connexion?reauth=1&next=${encodeURIComponent(path)}`;
  }

  private ack(rmqContext: RmqContext) {
    rmqContext.getChannelRef().ack(rmqContext.getMessage());
  }


  @EventPattern('notification.welcome')
  async onWelcome(@Payload() data: WelcomeDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Bienvenue sur BilletiX !',
      template: 'welcome',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.email_verification')
  async onEmailVerification(@Payload() data: EmailVerificationDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérifiez votre adresse email — BilletiX',
      template: 'email-verification',
      context: {
        firstName: data.firstName,
        verificationUrl: `${this.appUrl}/auth/verify-email?token=${data.token}`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.password_reset')
  async onPasswordReset(@Payload() data: PasswordResetDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Réinitialisation de votre mot de passe — BilletiX',
      template: 'password-reset',
      context: {
        firstName: data.firstName,
        resetUrl: `${this.appUrl}/auth/reset-password?token=${data.token}`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.order_confirmed')
  async onOrderConfirmed(@Payload() data: OrderConfirmedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Confirmation de commande ${data.orderReference} — BilletiX`,
      template: 'order-confirmed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.payment_confirmed')
  async onPaymentConfirmed(@Payload() data: PaymentConfirmedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Paiement confirmé — ${data.orderReference}`,
      template: 'payment-confirmed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.payment_failed')
  async onPaymentFailed(@Payload() data: PaymentFailedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Échec du paiement — ${data.orderReference}`,
      template: 'payment-failed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  /**
   * Bug corrigé (sécurité, demande produit) : l'email joignait les billets
   * en PDF et affichait leurs QR codes — un email transféré, un compte
   * email compromis ou un appareil partagé suffisait à entrer à la place du
   * titulaire. Désormais : aucun billet ni QR code dans l'email, seulement
   * un bouton vers l'application, qui exige une connexion à chaque clic.
   */
  @EventPattern('notification.ticket_ready')
  async onTicketReady(@Payload() data: TicketReadyDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Vos billets pour ${data.eventName} sont disponibles — BilletiX`,
      template: 'ticket-ready',
      context: {
        firstName: data.firstName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        eventVenue: data.eventVenue,
        ticketCount: data.tickets.length,
        plural: data.tickets.length > 1,
        ticketsUrl: this.reauthUrl('/profil/billets'),
      },
    });
    this.ack(rmqContext);
  }

  /**
   * Billet offert (transfert immédiat) : le bénéficiaire est prévenu, et
   * l'expéditeur reçoit une confirmation — qui sert aussi d'alerte si le
   * transfert n'est pas de son fait (compte compromis).
   */
  @EventPattern('notification.ticket_transferred')
  async onTicketTransferred(@Payload() data: TicketTransferredDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.recipientEmail,
      subject: `${data.senderFirstName} vous a offert un billet pour ${data.eventName} — BilletiX`,
      template: 'ticket-gift-received',
      context: { ...data, ticketsUrl: this.reauthUrl('/profil/billets') },
    });
    await this.mail.send({
      to: data.senderEmail,
      subject: `Billet ${data.ticketReference} transféré — BilletiX`,
      template: 'ticket-gift-sent',
      context: { ...data, historyUrl: this.reauthUrl('/profil/billets') },
    });
    this.ack(rmqContext);
  }

  /** Transfert annulé par un admin : l'expéditeur récupère le billet, le bénéficiaire le perd. */
  @EventPattern('notification.transfer_reverted')
  async onTransferReverted(@Payload() data: TransferRevertedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.senderEmail,
      subject: `Votre billet ${data.ticketReference} vous a été restitué — BilletiX`,
      template: 'transfer-reverted-sender',
      context: { ...data, ticketsUrl: this.reauthUrl('/profil/billets') },
    });
    await this.mail.send({
      to: data.recipientEmail,
      subject: `Billet ${data.ticketReference} retiré de votre compte — BilletiX`,
      template: 'transfer-reverted-recipient',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.transfer_revert_requested')
  async onTransferRevertRequested(@Payload() data: TransferRevertRequestedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.senderEmail,
      subject: `Demande d'annulation du transfert ${data.ticketReference} reçue — BilletiX`,
      template: 'transfer-revert-requested',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.transfer_revert_rejected')
  async onTransferRevertRejected(@Payload() data: TransferRevertRejectedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.senderEmail,
      subject: `Demande d'annulation du transfert ${data.ticketReference} refusée — BilletiX`,
      template: 'transfer-revert-rejected',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  /** Facture d'achat : détail complet de la commande + facture PDF jointe. */
  @EventPattern('notification.purchase_invoice')
  async onPurchaseInvoice(@Payload() data: PurchaseInvoiceDto, @Ctx() rmqContext: RmqContext) {
    // Facture transmise par l'api-gateway (bucket MinIO privé : plus aucun
    // lien public à télécharger ici).
    const attachments: MailAttachment[] = data.invoicePdfBase64
      ? [
          {
            filename: `facture-${data.orderReference}.pdf`,
            content: Buffer.from(data.invoicePdfBase64, 'base64'),
            contentType: 'application/pdf',
          },
        ]
      : [];

    await this.mail.send({
      to: data.email,
      subject: `Votre facture — commande ${data.orderReference} — BilletiX`,
      template: 'purchase-invoice',
      context: {
        ...data,
        invoicePdfBase64: undefined,
        hasInvoice: attachments.length > 0,
        orderUrl: this.reauthUrl(`/profil/commandes/${data.orderId}`),
      },
      attachments,
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_published')
  async onEventPublished(@Payload() data: EventPublishedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" est publié — BilletiX`,
      template: 'event-published',
      context: {
        firstName: data.firstName,
        eventName: data.event_name,
        eventsUrl: `${this.appUrl}/evenements/${data.event_id}`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_rejected')
  async onEventRejected(@Payload() data: EventRejectedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" a été refusé — BilletiX`,
      template: 'event-rejected',
      context: {
        firstName: data.firstName,
        eventName: data.event_name,
        reason: data.reason,
        eventId: data.event_id,
        appUrl: this.appUrl,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_info_requested')
  async onEventInfoRequested(@Payload() data: EventInfoRequestedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Complément d'information requis pour "${data.event_name}" — BilletiX`,
      template: 'event-info-requested',
      context: {
        firstName: data.firstName,
        eventName: data.event_name,
        message: data.message,
        eventId: data.event_id,
        appUrl: this.appUrl,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_suspended')
  async onEventSuspended(@Payload() data: EventSuspendedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" a été suspendu — BilletiX`,
      template: 'event-rejected',
      context: {
        firstName: data.firstName,
        eventName: data.event_name,
        reason: data.reason,
        eventId: data.event_id,
        appUrl: this.appUrl,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.kyc_approved')
  async onKycApproved(@Payload() data: KycApprovedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Votre identité a été vérifiée — BilletiX',
      template: 'kyc-approved',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.kyc_rejected')
  async onKycRejected(@Payload() data: KycRejectedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérification d\'identité refusée — BilletiX',
      template: 'kyc-rejected',
      context: { firstName: data.firstName, reason: data.reason, appUrl: this.appUrl },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_canceled')
  async onEventCanceled(@Payload() data: EventCanceledDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Annulation — ${data.eventName}`,
      template: 'event-canceled',
      context: {
        ...data,
        eventsUrl: `${this.appUrl}/catalogue`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_updated')
  async onEventUpdated(@Payload() data: EventUpdatedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Mise à jour — ${data.eventName}`,
      template: 'event-updated',
      context: {
        firstName: data.firstName,
        eventName: data.eventName,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.first_sale')
  async onFirstSale(@Payload() data: FirstSaleDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Première vente — ${data.eventName}`,
      template: 'first-sale',
      context: {
        firstName: data.firstName,
        eventName: data.eventName,
        dashboardUrl: `${this.appUrl}/dashboard`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.fill_threshold_reached')
  async onFillThresholdReached(@Payload() data: FillThresholdReachedDto, @Ctx() rmqContext: RmqContext) {
    if (data.email) {
      await this.mail.send({
        to: data.email,
        subject: `${data.threshold}% de vos places vendues — ${data.event_name}`,
        template: 'fill-threshold',
        context: {
          firstName: data.firstName ?? 'Organisateur',
          eventName: data.event_name,
          threshold: data.threshold,
          soldCount: data.sold_count,
          totalCapacity: data.total_capacity,
          dashboardUrl: `${this.appUrl}/dashboard`,
        },
      });
    }
    this.ack(rmqContext);
  }

  @EventPattern('notification.ticket_scanned')
  async onTicketScanned(@Payload() data: TicketScannedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Billet validé — ${data.eventName}`,
      template: 'ticket-scanned',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.newsletter')
  async onNewsletter(@Payload() data: NewsletterDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: data.subject,
      template: 'newsletter',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_recommendations')
  async onEventRecommendations(
    @Payload() data: EventRecommendationsDto,
    @Ctx() rmqContext: RmqContext,
  ) {
    await this.mail.send({
      to: data.email,
      subject: 'Des événements qui pourraient te plaire',
      template: 'event-recommendations',
      context: {
        firstName: data.firstName,
        events: data.events.map((event) => ({
          ...event,
          eventUrl: `${this.appUrl}/evenements/${event.eventId}`,
        })),
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.refund_completed')
  async onRefundCompleted(@Payload() data: RefundCompletedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Remboursement effectué — ${data.orderReference}`,
      template: 'refund-completed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.resale_sold')
  async onResaleSold(@Payload() data: ResaleSoldDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Ton billet est vendu ! — ${data.eventName}`,
      template: 'resale-sold',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/profil/commandes`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.resale_listed')
  async onResaleListed(@Payload() data: ResaleListedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Ton billet est en vente — ${data.eventName}`,
      template: 'resale-listed',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/profil/billets`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.resale_withdrawn')
  async onResaleWithdrawn(@Payload() data: ResaleWithdrawnDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Ton billet a été retiré de la vente — ${data.eventName}`,
      template: 'resale-withdrawn',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/profil/billets`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.payout_completed')
  async onPayoutCompleted(@Payload() data: PayoutCompletedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Reversement effectué — ${data.eventName}`,
      template: 'payout-completed',
      context: {
        ...data,
        dashboardUrl: `${this.appUrl}/dashboard`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.dispute_opened')
  async onDisputeOpened(@Payload() data: DisputeOpenedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Litige ouvert — ${data.eventName}`,
      template: 'dispute-opened',
      context: {
        ...data,
        dashboardUrl: `${this.appUrl}/dashboard`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.dispute_resolved')
  async onDisputeResolved(@Payload() data: DisputeResolvedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Litige résolu — ${data.eventName}`,
      template: 'dispute-resolved',
      context: {
        ...data,
        isWon: data.status === 'WON',
        isLost: data.status === 'LOST',
        isClosed: data.status === 'CLOSED',
        dashboardUrl: `${this.appUrl}/dashboard`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_suspended')
  async onAccountSuspended(@Payload() data: AccountSuspendedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte suspendu — BilletiX',
      template: 'account-suspended',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_unsuspended')
  async onAccountUnsuspended(@Payload() data: AccountUnsuspendedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte réactivé — BilletiX',
      template: 'account-unsuspended',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_unlocked')
  async onAccountUnlocked(@Payload() data: AccountUnlockedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte déverrouillé — BilletiX',
      template: 'account-unlocked',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_activated')
  async onAccountActivated(@Payload() data: AccountActivatedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte activé — BilletiX',
      template: 'account-activated',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.two_factor_reset_by_admin')
  async onTwoFactorResetByAdmin(@Payload() data: TwoFactorResetByAdminDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Double authentification réinitialisée — BilletiX',
      template: 'two-factor-reset-by-admin',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_reminder')
  async onEventReminder(@Payload() data: EventReminderDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Rappel — ${data.eventName} c'est demain !`,
      template: 'event-reminder',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/profil/billets`,
      },
    });
    this.ack(rmqContext);
  }
}
