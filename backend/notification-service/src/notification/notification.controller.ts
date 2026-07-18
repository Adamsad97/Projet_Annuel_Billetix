import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import * as http from 'http';
import { MailAttachment, MailService } from '../mail/mail.service';
import { EmailVerificationDto } from './dto/email-verification.dto';
import { EventCanceledDto } from './dto/event-canceled.dto';
import { EventInfoRequestedDto } from './dto/event-info-requested.dto';
import { EventPublishedDto } from './dto/event-published.dto';
import { EventReminderDto } from './dto/event-reminder.dto';
import { EventRejectedDto } from './dto/event-rejected.dto';
import { EventSuspendedDto } from './dto/event-suspended.dto';
import { FillThresholdReachedDto } from './dto/fill-threshold-reached.dto';
import { KycApprovedDto } from './dto/kyc-approved.dto';
import { KycRejectedDto } from './dto/kyc-rejected.dto';
import { OrderConfirmedDto } from './dto/order-confirmed.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { PaymentConfirmedDto } from './dto/payment-confirmed.dto';
import { PaymentFailedDto } from './dto/payment-failed.dto';
import { TicketReadyDto } from './dto/ticket-ready.dto';
import { TicketScannedDto } from './dto/ticket-scanned.dto';
import { WelcomeDto } from './dto/welcome.dto';

@Controller()
export class NotificationController {
  private readonly appUrl: string;
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  private ack(ctx: RmqContext) {
    ctx.getChannelRef().ack(ctx.getMessage());
  }

  // Les PDF (billets/factures) sont sur MinIO en lecture publique — un
  // échec de téléchargement ne doit jamais empêcher l'envoi de l'email,
  // juste faire retomber sur le lien classique (dégradation silencieuse).
  private fetchPdf(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      http
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            this.logger.warn(`PDF inaccessible (${res.statusCode}) : ${url}`);
            res.resume();
            resolve(null);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', (err) => {
          this.logger.warn(`Échec téléchargement PDF ${url} : ${err.message}`);
          resolve(null);
        });
    });
  }

  @EventPattern('notification.welcome')
  async onWelcome(@Payload() data: WelcomeDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Bienvenue sur BilletiX !',
      template: 'welcome',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.email_verification')
  async onEmailVerification(@Payload() data: EmailVerificationDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérifiez votre adresse email — BilletiX',
      template: 'email-verification',
      context: {
        firstName: data.firstName,
        verificationUrl: `${this.appUrl}/auth/verify-email?token=${data.token}`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.password_reset')
  async onPasswordReset(@Payload() data: PasswordResetDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Réinitialisation de votre mot de passe — BilletiX',
      template: 'password-reset',
      context: {
        firstName: data.firstName,
        resetUrl: `${this.appUrl}/auth/reset-password?token=${data.token}`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.order_confirmed')
  async onOrderConfirmed(@Payload() data: OrderConfirmedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Confirmation de commande ${data.orderReference} — BilletiX`,
      template: 'order-confirmed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/orders`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.payment_confirmed')
  async onPaymentConfirmed(@Payload() data: PaymentConfirmedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Paiement confirmé — ${data.orderReference}`,
      template: 'payment-confirmed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/orders`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.payment_failed')
  async onPaymentFailed(@Payload() data: PaymentFailedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Échec du paiement — ${data.orderReference}`,
      template: 'payment-failed',
      context: {
        ...data,
        ordersUrl: `${this.appUrl}/orders`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.ticket_ready')
  async onTicketReady(@Payload() data: TicketReadyDto, @Ctx() ctx: RmqContext) {
    const attachments: MailAttachment[] = [];
    for (const [index, ticket] of data.tickets.entries()) {
      if (!ticket.pdfUrl) continue;
      const pdf = await this.fetchPdf(ticket.pdfUrl);
      if (pdf) {
        attachments.push({
          filename: `billet-${ticket.ticketNumber || index + 1}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        });
      }
    }

    await this.mail.send({
      to: data.email,
      subject: `Vos billets pour ${data.eventName} — BilletiX`,
      template: 'ticket-ready',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/tickets`,
      },
      attachments,
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_published')
  async onEventPublished(@Payload() data: EventPublishedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" est publié — BilletiX`,
      template: 'event-published',
      context: { firstName: data.firstName, eventName: data.event_name, eventsUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_rejected')
  async onEventRejected(@Payload() data: EventRejectedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" a été refusé — BilletiX`,
      template: 'event-rejected',
      context: { firstName: data.firstName, eventName: data.event_name, reason: data.reason, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_info_requested')
  async onEventInfoRequested(@Payload() data: EventInfoRequestedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Complément d'information requis pour "${data.event_name}" — BilletiX`,
      template: 'event-info-requested',
      context: { firstName: data.firstName, eventName: data.event_name, message: data.message, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_suspended')
  async onEventSuspended(@Payload() data: EventSuspendedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Votre événement "${data.event_name}" a été suspendu — BilletiX`,
      template: 'event-rejected',
      context: { firstName: data.firstName, eventName: data.event_name, reason: data.reason, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.kyc_approved')
  async onKycApproved(@Payload() data: KycApprovedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Votre identité a été vérifiée — BilletiX',
      template: 'kyc-approved',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.kyc_rejected')
  async onKycRejected(@Payload() data: KycRejectedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: 'Vérification d\'identité refusée — BilletiX',
      template: 'kyc-rejected',
      context: { firstName: data.firstName, reason: data.reason, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_canceled')
  async onEventCanceled(@Payload() data: EventCanceledDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Annulation — ${data.eventName}`,
      template: 'event-canceled',
      context: {
        ...data,
        eventsUrl: `${this.appUrl}/events`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.fill_threshold_reached')
  async onFillThresholdReached(@Payload() data: FillThresholdReachedDto, @Ctx() ctx: RmqContext) {
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
          dashboardUrl: `${this.appUrl}/organizer/events`,
        },
      });
    }
    this.ack(ctx);
  }

  @EventPattern('notification.ticket_scanned')
  async onTicketScanned(@Payload() data: TicketScannedDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Billet validé — ${data.eventName}`,
      template: 'ticket-scanned',
      context: { ...data },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_reminder')
  async onEventReminder(@Payload() data: EventReminderDto, @Ctx() ctx: RmqContext) {
    await this.mail.send({
      to: data.email,
      subject: `Rappel — ${data.eventName} c'est demain !`,
      template: 'event-reminder',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/tickets`,
      },
    });
    this.ack(ctx);
  }
}
