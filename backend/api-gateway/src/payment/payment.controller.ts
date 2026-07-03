import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
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
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
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

  // ─── Webhook Stripe (public, pas de JWT) ────────────────────────────────────

  @Public()
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Stripe (signature vérifiée côté payment-service)' })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return firstValueFrom(
      this.paymentClient.send('payment.confirm_webhook', {
        payload: req.rawBody?.toString('utf8') ?? '',
        signature,
      }),
    );
  }
}
