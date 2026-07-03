import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { MailService } from '../mail/mail.service';

@Controller()
export class NotificationController {
  private readonly appUrl: string;

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  private ack(ctx: RmqContext) {
    ctx.getChannelRef().ack(ctx.getMessage());
  }

  @EventPattern('notification.welcome')
  async onWelcome(
    @Payload() data: { email: string; firstName: string },
    @Ctx() ctx: RmqContext,
  ) {
    await this.mail.send({
      to: data.email,
      subject: 'Bienvenue sur BilletiX !',
      template: 'welcome',
      context: { firstName: data.firstName, appUrl: this.appUrl },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.email_verification')
  async onEmailVerification(
    @Payload() data: { email: string; firstName: string; token: string },
    @Ctx() ctx: RmqContext,
  ) {
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
  async onPasswordReset(
    @Payload() data: { email: string; firstName: string; token: string },
    @Ctx() ctx: RmqContext,
  ) {
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
  async onOrderConfirmed(
    @Payload() data: {
      email: string;
      firstName: string;
      orderReference: string;
      eventName: string;
      eventDate: string;
      eventVenue: string;
      items: Array<{ categoryName: string; quantity: number; unitPrice: string; totalPrice: string }>;
      totalTtc: string;
    },
    @Ctx() ctx: RmqContext,
  ) {
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
  async onPaymentConfirmed(
    @Payload() data: {
      email: string;
      firstName: string;
      orderReference: string;
      eventName: string;
      amount: string;
      paymentDate: string;
      paymentMethod: string;
    },
    @Ctx() ctx: RmqContext,
  ) {
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

  @EventPattern('notification.ticket_ready')
  async onTicketReady(
    @Payload() data: {
      email: string;
      firstName: string;
      eventName: string;
      eventDate: string;
      eventVenue: string;
      tickets: Array<{ ticketNumber: string; categoryName: string; seatInfo?: string; qrCodeUrl: string }>;
    },
    @Ctx() ctx: RmqContext,
  ) {
    await this.mail.send({
      to: data.email,
      subject: `Vos billets pour ${data.eventName} — BilletiX`,
      template: 'ticket-ready',
      context: {
        ...data,
        ticketsUrl: `${this.appUrl}/tickets`,
      },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_canceled')
  async onEventCanceled(
    @Payload() data: {
      email: string;
      firstName: string;
      eventName: string;
      eventDate: string;
      eventVenue: string;
      refundAmount: string;
      cancellationReason?: string;
    },
    @Ctx() ctx: RmqContext,
  ) {
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

  @EventPattern('notification.ticket_scanned')
  async onTicketScanned(
    @Payload() data: {
      email: string;
      firstName: string;
      eventName: string;
      eventDate: string;
      venueName: string;
      eventCity: string;
      artistName: string;
      categoryName: string;
      holderName: string;
      scannedAt: string;
    },
    @Ctx() ctx: RmqContext,
  ) {
    await this.mail.send({
      to: data.email,
      subject: `Billet validé — ${data.eventName}`,
      template: 'ticket-scanned',
      context: { ...data },
    });
    this.ack(ctx);
  }

  @EventPattern('notification.event_reminder')
  async onEventReminder(
    @Payload() data: {
      email: string;
      firstName: string;
      eventName: string;
      eventDate: string;
      eventTime: string;
      eventVenue: string;
      eventAddress?: string;
      requiresId?: boolean;
    },
    @Ctx() ctx: RmqContext,
  ) {
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
