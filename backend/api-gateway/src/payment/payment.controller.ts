import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    @Inject('PAYMENT_SERVICE')      private readonly paymentClient: ClientProxy,
    @Inject('ORDER_SERVICE')        private readonly orderClient: ClientProxy,
    @Inject('TICKET_SERVICE')       private readonly ticketClient: ClientProxy,
    @Inject('PDF_SERVICE')          private readonly pdfClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notifClient: ClientProxy,
  ) {}

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un PaymentIntent Stripe' })
  createIntent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.create_intent', {
        ...dto,
        buyer_email: user.email,
      }),
    );
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Paiement d\'une commande' })
  getByOrder(@Param('orderId') orderId: string) {
    return firstValueFrom(
      this.paymentClient.send('payment.get_by_order', { order_id: orderId }),
    );
  }

  @Post('refund/:orderId')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rembourser une commande (ADMIN)' })
  refund(
    @Param('orderId') orderId: string,
    @Body() dto: { amount_cents?: number },
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.refund', {
        order_id: orderId,
        amount_cents: dto.amount_cents,
      }),
    );
  }

  // ─── Reversements ───────────────────────────────────────────────────────────

  @Get('payouts/me')
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Mes reversements (ORGANIZER)' })
  myPayouts(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.paymentClient.send('payment.get_payouts_by_organizer', {
        organizer_id: user.sub,
      }),
    );
  }

  @Post('payouts/:id/request-early')
  @HttpCode(HttpStatus.OK)
  @Roles('ORGANIZER')
  @ApiOperation({ summary: 'Demander un reversement anticipé (ORGANIZER)' })
  requestEarlyPayout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.request_early_payout', {
        id,
        organizer_id: user.sub,
      }),
    );
  }

  @Post('payouts/:id/approve-early')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approuver un reversement anticipé (ADMIN)' })
  approveEarlyPayout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.approve_early_payout', {
        id,
        admin_id: user.sub,
      }),
    );
  }

  @Post('payouts/:id/block')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bloquer un reversement (ADMIN)' })
  blockPayout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.block_payout', {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
  }

  // ─── Litiges ────────────────────────────────────────────────────────────────

  @Post('disputes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ouvrir un litige' })
  createDispute(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      payment_id: string;
      order_id: string;
      reason: string;
      description?: string;
    },
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.create_dispute', {
        ...dto,
        buyer_id: user.sub,
      }),
    );
  }

  @Get('disputes/me')
  @ApiOperation({ summary: 'Mes litiges' })
  myDisputes(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.paymentClient.send('payment.get_disputes_by_buyer', {
        buyer_id: user.sub,
      }),
    );
  }

  @Get('disputes/order/:orderId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Litiges d\'une commande (ADMIN)' })
  disputesByOrder(@Param('orderId') orderId: string) {
    return firstValueFrom(
      this.paymentClient.send('payment.get_disputes_by_order', {
        order_id: orderId,
      }),
    );
  }

  @Post('disputes/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Résoudre un litige (ADMIN)' })
  resolveDispute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: { status: string; resolution_notes?: string },
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.resolve_dispute', {
        id,
        ...dto,
        resolved_by: user.sub,
      }),
    );
  }

  // ─── Webhook Stripe ─────────────────────────────────────────────────────────

  @Public()
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Stripe (signature vérifiée côté payment-service)' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    // 1. Vérifier signature + confirmer paiement dans payment-service
    const confirmed = await firstValueFrom(
      this.paymentClient.send('payment.confirm_webhook', {
        payload: req.rawBody?.toString('utf8') ?? '',
        signature,
      }),
    ) as { received: boolean; order_id?: string; already_processed?: boolean };

    if (!confirmed.order_id || confirmed.already_processed) {
      return { received: true };
    }

    // 2. Post-confirmation asynchrone — ne bloque pas la réponse à Stripe
    this.postPaymentConfirmed(confirmed.order_id).catch((err) =>
      this.logger.error(`Erreur post-paiement order ${confirmed.order_id}: ${err?.message}`),
    );

    return { received: true };
  }

  // ─── Orchestration post-paiement ────────────────────────────────────────────

  private async postPaymentConfirmed(orderId: string): Promise<void> {
    // 2a. Récupérer la commande (buyer + items + event info)
    const order = await firstValueFrom(
      this.orderClient.send('order.get', { id: orderId }),
    ) as {
      id: string;
      buyer_id: string;
      buyer_email: string;
      buyer_first_name: string;
      buyer_last_name: string;
      total_amount_ttc: number;
      items: {
        ticket_category_id: string;
        ticket_category_name: string;
        unit_price_ttc: number;
        quantity: number;
        holder_first_name: string;
        holder_last_name: string;
        seat_info?: string;
      }[];
      event_id: string;
      event_name: string;
      event_start_at: string;
      event_end_at?: string;
      event_venue_name: string;
      event_venue_address: string;
      event_city: string;
      event_poster_url?: string;
      artist_name: string;
      artist_description?: string;
    };

    // 2b. Générer les billets dans ticket-service
    const tickets = await firstValueFrom(
      this.ticketClient.send('ticket.generate', {
        order_id: orderId,
        buyer_id: order.buyer_id,
        buyer_email: order.buyer_email,
        event_id: order.event_id,
        event_name: order.event_name,
        event_start_at: order.event_start_at,
        event_end_at: order.event_end_at,
        event_venue_name: order.event_venue_name,
        event_venue_address: order.event_venue_address,
        event_city: order.event_city,
        event_poster_url: order.event_poster_url,
        artist_name: order.artist_name,
        artist_description: order.artist_description,
        items: order.items,
      }),
    ) as Array<{
      id: string;
      reference: string;
      qr_code_url: string;
      ticket_category_name: string;
      unit_price_ttc: number;
      seat_info?: string;
      holder_first_name: string;
      holder_last_name: string;
    }>;

    // 2c. Pour chaque billet : déclencher génération PDF + notification (fire-and-forget)
    const ticketList = tickets.map((t) => ({
      ticket_id: t.id,
      qr_code_url: t.qr_code_url,
      ticket_category_name: t.ticket_category_name,
    }));

    for (const ticket of tickets) {
      // PDF
      this.pdfClient.emit('pdf.generate_ticket', {
        ticket_id: ticket.id,
        reference: ticket.reference,
        order_id: orderId,
        event_name: order.event_name,
        event_start_at: order.event_start_at,
        event_venue_name: order.event_venue_name,
        event_venue_address: order.event_venue_address,
        event_city: order.event_city,
        event_poster_url: order.event_poster_url,
        artist_name: order.artist_name,
        ticket_category_name: ticket.ticket_category_name,
        unit_price_ttc: ticket.unit_price_ttc,
        seat_info: ticket.seat_info,
        holder_first_name: ticket.holder_first_name,
        holder_last_name: ticket.holder_last_name,
        buyer_email: order.buyer_email,
        qr_code_url: ticket.qr_code_url,
      });
    }

    // Notification : commande + billets confirmés (un seul email groupé)
    this.notifClient.emit('notification.payment_confirmed', {
      email: order.buyer_email,
      first_name: order.buyer_first_name,
      last_name: order.buyer_last_name,
      order_id: orderId,
      event_name: order.event_name,
      event_date: order.event_start_at,
      event_venue: order.event_venue_name,
      tickets: ticketList,
      total_amount_ttc: order.total_amount_ttc,
    });

    this.notifClient.emit('notification.ticket_ready', {
      email: order.buyer_email,
      first_name: order.buyer_first_name,
      last_name: order.buyer_last_name,
      event_name: order.event_name,
      event_date: order.event_start_at,
      event_venue: order.event_venue_name,
      tickets: ticketList,
    });

    this.logger.log(`Post-paiement traité : ${tickets.length} billet(s) générés pour commande ${orderId}`);
  }
}
