import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PayoutService } from './payout.service';

@Controller()
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @MessagePattern('payment.create_payout')
  create(@Payload() data: {
    organizer_id: string;
    event_id: string;
    gross_amount: number;
    commission_amount: number;
    payment_fees_amount: number;
    event_end_at?: string;
  }) {
    return this.payoutService.create(data);
  }

  @MessagePattern('payment.get_organizer_balance')
  getOrganizerBalance(@Payload() data: { organizer_id: string }) {
    return this.payoutService.getOrganizerBalance(data.organizer_id);
  }

  @MessagePattern('payment.get_payout')
  getById(@Payload() data: { id: string }) {
    return this.payoutService.getById(data.id);
  }

  @MessagePattern('payment.get_payouts_by_organizer')
  getByOrganizer(@Payload() data: { organizer_id: string }) {
    return this.payoutService.getByOrganizer(data.organizer_id);
  }

  @MessagePattern('payment.process_payout')
  process(@Payload() data: { id: string; stripe_account_id: string }) {
    return this.payoutService.process(data.id, data.stripe_account_id);
  }

  @MessagePattern('payment.block_payout')
  block(@Payload() data: { id: string; admin_id: string; reason: string }) {
    return this.payoutService.block(data.id, data.admin_id, data.reason);
  }

  @MessagePattern('payment.request_early_payout')
  requestEarly(@Payload() data: { id: string; organizer_id: string }) {
    return this.payoutService.requestEarly(data.id, data.organizer_id);
  }

  @MessagePattern('payment.approve_early_payout')
  approveEarly(@Payload() data: { id: string; admin_id: string }) {
    return this.payoutService.approveEarly(data.id, data.admin_id);
  }
}
