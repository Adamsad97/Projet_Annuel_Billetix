import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { MailAttachment, MailService } from '../mail/mail.service';
import { AccountActivatedDto } from './dto/account-activated.dto';
import { EventPostponedDto } from './dto/event-postponed.dto';
import { AdminChangeRequestDto } from './dto/admin-change-request.dto';
import { AdminNoticeDto } from './dto/admin-notice.dto';
import { DisputeResolvedBuyerDto } from './dto/dispute-resolved-buyer.dto';
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
import { OrganizerEventNoticeDto, type OrganizerEventNoticeKind } from './dto/organizer-event-notice.dto';
import { organizerEventNotice } from './organizer-event-notice';
import { EventUpdatedDto } from './dto/event-updated.dto';
import { FirstSaleDto } from './dto/first-sale.dto';
import { DisputeOpenedDto } from './dto/dispute-opened.dto';
import { DisputeResolvedDto } from './dto/dispute-resolved.dto';
import { FillThresholdReachedDto } from './dto/fill-threshold-reached.dto';
import { PayoutCompletedDto } from './dto/payout-completed.dto';
import { IbanChangedDto } from './dto/iban-changed.dto';
import { RefundCompletedDto } from './dto/refund-completed.dto';
import { ResaleListedDto } from './dto/resale-listed.dto';
import { ResaleSoldDto } from './dto/resale-sold.dto';
import { ResaleWithdrawnDto } from './dto/resale-withdrawn.dto';
import { KycApprovedDto } from './dto/kyc-approved.dto';
import { KycRejectedDto } from './dto/kyc-rejected.dto';
import { NewsletterDto } from './dto/newsletter.dto';
import { OrderConfirmedDto } from './dto/order-confirmed.dto';
import { AgentInvitationDto } from './dto/agent-invitation.dto';
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
    // Liens d'email vers FRONTEND_URL (pas APP_URL, qui pointe vers l'API).
    this.appUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /** Lien vers une page sensible : passe par la connexion avec reauth=1, puis renvoie vers path. */
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
      subject: 'Bienvenue sur BilleTix !',
      template: 'welcome',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.email_verification')
  async onEmailVerification(@Payload() data: EmailVerificationDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérifiez votre adresse email — BilleTix',
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
      subject: 'Réinitialisation de votre mot de passe — BilleTix',
      template: 'password-reset',
      context: {
        firstName: data.firstName,
        resetUrl: `${this.appUrl}/auth/reset-password?token=${data.token}`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.agent_invitation')
  async onAgentInvitation(@Payload() data: AgentInvitationDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Agent de contrôle pour "${data.eventName}" — BilleTix`,
      template: 'agent-invitation',
      context: {
        firstName: data.firstName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        organizerName: data.organizerName,
        setPasswordUrl: data.token ? `${this.appUrl}/auth/reset-password?token=${data.token}` : null,
        validHours: data.validHours,
        scanUrl: `${this.appUrl}/scan`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.order_confirmed')
  async onOrderConfirmed(@Payload() data: OrderConfirmedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Confirmation de commande ${data.orderReference} — BilleTix`,
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

  /** Sécurité : aucun billet ni QR code dans l'email, seulement un bouton vers l'application (connexion exigée). */
  @EventPattern('notification.ticket_ready')
  async onTicketReady(@Payload() data: TicketReadyDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Vos billets pour ${data.eventName} sont disponibles — BilleTix`,
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

  /** Billet offert : le bénéficiaire est prévenu, l'expéditeur reçoit une confirmation qui sert aussi d'alerte. */
  @EventPattern('notification.ticket_transferred')
  async onTicketTransferred(@Payload() data: TicketTransferredDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.recipientEmail,
      subject: `${data.senderFirstName} vous a offert un billet pour ${data.eventName} — BilleTix`,
      template: 'ticket-gift-received',
      context: { ...data, ticketsUrl: this.reauthUrl('/profil/billets') },
    });
    await this.mail.send({
      to: data.senderEmail,
      subject: `Billet ${data.ticketReference} transféré — BilleTix`,
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
      subject: `Votre billet ${data.ticketReference} vous a été restitué — BilleTix`,
      template: 'transfer-reverted-sender',
      context: { ...data, ticketsUrl: this.reauthUrl('/profil/billets') },
    });
    await this.mail.send({
      to: data.recipientEmail,
      subject: `Billet ${data.ticketReference} retiré de votre compte — BilleTix`,
      template: 'transfer-reverted-recipient',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.transfer_revert_requested')
  async onTransferRevertRequested(@Payload() data: TransferRevertRequestedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.senderEmail,
      subject: `Demande d'annulation du transfert ${data.ticketReference} reçue — BilleTix`,
      template: 'transfer-revert-requested',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.transfer_revert_rejected')
  async onTransferRevertRejected(@Payload() data: TransferRevertRejectedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.senderEmail,
      subject: `Demande d'annulation du transfert ${data.ticketReference} refusée — BilleTix`,
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
      subject: `Votre facture — commande ${data.orderReference} — BilleTix`,
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
      subject: `Votre événement "${data.event_name}" est publié — BilleTix`,
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
      subject: `Votre événement "${data.event_name}" a été refusé — BilleTix`,
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
      subject: `Complément d'information requis pour "${data.event_name}" — BilleTix`,
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

  /** Email à l'organisateur pour une action de l'administration sur son événement. */
  private async sendOrganizerEventNotice(data: {
    email: string;
    firstName: string;
    event_id: string;
    event_name: string;
    kind: OrganizerEventNoticeKind;
    message?: string;
  }): Promise<void> {
    const content = organizerEventNotice(data.kind, data.event_name);
    await this.mail.send({
      to: data.email,
      subject: content.subject,
      template: 'organizer-event-notice',
      context: {
        ...content,
        firstName: data.firstName,
        eventName: data.event_name,
        message: data.message?.trim() || null,
        eventUrl: `${this.appUrl}/dashboard/evenements/${data.event_id}`,
      },
    });
  }

  // Bug corrigé : la désactivation réutilisait l'email de refus de
  // validation (« votre événement n'a pas pu être approuvé »).
  @EventPattern('notification.event_suspended')
  async onEventSuspended(@Payload() data: EventSuspendedDto, @Ctx() rmqContext: RmqContext) {
    await this.sendOrganizerEventNotice({ ...data, kind: 'SUSPENDED', message: data.reason });
    this.ack(rmqContext);
  }

  @EventPattern('notification.organizer_event_notice')
  async onOrganizerEventNotice(@Payload() data: OrganizerEventNoticeDto, @Ctx() rmqContext: RmqContext) {
    await this.sendOrganizerEventNotice(data);
    this.ack(rmqContext);
  }

  @EventPattern('notification.kyc_approved')
  async onKycApproved(@Payload() data: KycApprovedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Votre identité a été vérifiée — BilleTix',
      template: 'kyc-approved',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.kyc_rejected')
  async onKycRejected(@Payload() data: KycRejectedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérification d\'identité refusée — BilleTix',
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
        eventsUrl: `${this.appUrl}/evenements`,
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

  @EventPattern('notification.admin_notice')
  async onAdminNotice(@Payload() data: AdminNoticeDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: data.subject,
      template: 'admin-notice',
      context: { ...data, details: data.details ?? [], ctaUrl: `${this.appUrl}${data.ctaPath}` },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.admin_change_request')
  async onAdminChangeRequest(@Payload() data: AdminChangeRequestDto, @Ctx() rmqContext: RmqContext) {
    const postponement = data.kind === 'POSTPONEMENT';
    const isMessage = data.action === 'MESSAGE';
    const what = postponement ? 'de report' : "d'annulation";
    await this.mail.send({
      to: data.email,
      subject: isMessage
        ? `Réponse de l'organisateur sur une demande ${what} — ${data.eventName}`
        : `Nouvelle demande ${what} — ${data.eventName}`,
      template: 'admin-change-request',
      context: {
        ...data,
        postponement,
        isMessage,
        headline: isMessage ? "L'organisateur a répondu" : `Nouvelle demande ${what}`,
        intro: isMessage
          ? `L'organisateur a ajouté un message à sa demande ${what} :`
          : `Un organisateur demande ${postponement ? 'le report' : "l'annulation"} de son événement :`,
        textLabel: isMessage ? 'Message' : 'Motif',
        requestsUrl: `${this.appUrl}/admin/annulations`,
      },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.event_postponed')
  async onEventPostponed(@Payload() data: EventPostponedDto, @Ctx() rmqContext: RmqContext) {
    const rescheduled = data.announcement === 'RESCHEDULED';
    await this.mail.send({
      to: data.email,
      subject: rescheduled ? `Nouvelle date — ${data.eventName}` : `Événement reporté — ${data.eventName}`,
      template: 'event-postponed',
      context: {
        ...data,
        rescheduled,
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
          dashboardUrl: data.event_id ? `${this.appUrl}/dashboard/evenements/${data.event_id}` : `${this.appUrl}/dashboard`,
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
      subject: 'Des événements qui pourraient vous plaire',
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
      subject: `Votre billet est vendu ! — ${data.eventName}`,
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
      subject: `Votre billet est en vente — ${data.eventName}`,
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
      subject: `Votre billet a été retiré de la vente — ${data.eventName}`,
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

  @EventPattern('notification.iban_changed')
  async onIbanChanged(@Payload() data: IbanChangedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Coordonnées bancaires modifiées — BilleTix',
      template: 'iban-changed',
      context: { ...data, paymentsUrl: `${this.appUrl}/dashboard/paiements` },
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

  @EventPattern('notification.dispute_resolved_buyer')
  async onDisputeResolvedBuyer(@Payload() data: DisputeResolvedBuyerDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre réclamation — commande ${data.orderReference}`,
      template: 'dispute-resolved-buyer',
      context: {
        ...data,
        isWon: data.status === 'WON',
        isLost: data.status === 'LOST',
        isClosed: data.status === 'CLOSED',
        ordersUrl: `${this.appUrl}/profil/commandes`,
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
      subject: 'Compte suspendu — BilleTix',
      template: 'account-suspended',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_unsuspended')
  async onAccountUnsuspended(@Payload() data: AccountUnsuspendedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte réactivé — BilleTix',
      template: 'account-unsuspended',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_unlocked')
  async onAccountUnlocked(@Payload() data: AccountUnlockedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte déverrouillé — BilleTix',
      template: 'account-unlocked',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.account_activated')
  async onAccountActivated(@Payload() data: AccountActivatedDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Compte activé — BilleTix',
      template: 'account-activated',
      context: { ...data },
    });
    this.ack(rmqContext);
  }

  @EventPattern('notification.two_factor_reset_by_admin')
  async onTwoFactorResetByAdmin(@Payload() data: TwoFactorResetByAdminDto, @Ctx() rmqContext: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Double authentification réinitialisée — BilleTix',
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
