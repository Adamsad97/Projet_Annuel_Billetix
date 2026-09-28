import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PayoutService } from './payout.service';
import { AdminPayoutPayload, BlockPayoutPayload, CreatePayoutPayload, IdPayload, ListPayoutsPayload, OrganizerPayload, OwnedPayoutPayload, ProcessPayoutPayload } from '../common/payloads';

@Controller()
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @MessagePattern('payment.create_payout')
  create(@Payload() data: CreatePayoutPayload) {
    return this.payoutService.create(data);
  }

  @MessagePattern('payment.get_organizer_balance')
  getOrganizerBalance(@Payload() data: OrganizerPayload) {
    return this.payoutService.getOrganizerBalance(data.organizer_id);
  }

  @MessagePattern('payment.get_platform_balance')
  getPlatformBalance() {
    return this.payoutService.getPlatformBalance();
  }

  @MessagePattern('payment.get_payout')
  getById(@Payload() data: IdPayload) {
    return this.payoutService.getById(data.id);
  }

  @MessagePattern('payment.get_payouts_by_organizer')
  getByOrganizer(@Payload() data: OrganizerPayload) {
    return this.payoutService.getByOrganizer(data.organizer_id);
  }

  @MessagePattern('payment.get_payout_stats')
  getStats() {
    return this.payoutService.getStats();
  }

  @MessagePattern('payment.list_all_payouts')
  listAll(@Payload() data: ListPayoutsPayload) {
    return this.payoutService.listAll(data as Parameters<PayoutService['listAll']>[0]);
  }

  @MessagePattern('payment.process_payout')
  process(@Payload() data: ProcessPayoutPayload) {
    return this.payoutService.process(data.id, data.stripe_account_id);
  }

  @MessagePattern('payment.block_payout')
  block(@Payload() data: BlockPayoutPayload) {
    return this.payoutService.block(data.id, data.admin_id, data.reason);
  }

  @MessagePattern('payment.unblock_payout')
  unblock(@Payload() data: IdPayload) {
    return this.payoutService.unblock(data.id);
  }

  @MessagePattern('payment.request_early_payout')
  requestEarly(@Payload() data: OwnedPayoutPayload) {
    return this.payoutService.requestEarly(data.id, data.organizer_id);
  }

  @MessagePattern('payment.approve_early_payout')
  approveEarly(@Payload() data: AdminPayoutPayload) {
    return this.payoutService.approveEarly(data.id, data.admin_id);
  }
}
