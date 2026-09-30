import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DisputeService } from './dispute.service';
import { BuyerPayload, CloseStripeDisputePayload, CreateDisputePayload, IdPayload, OrderIdPayload, ResolveDisputePayload, UpdateDisputeStatusPayload } from '../common/payloads';

@Controller()
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @MessagePattern('payment.create_dispute')
  create(@Payload() data: CreateDisputePayload) {
    return this.disputeService.create(data);
  }

  @MessagePattern('payment.get_dispute')
  getById(@Payload() data: IdPayload) {
    return this.disputeService.getById(data.id);
  }

  @MessagePattern('payment.get_all_disputes')
  getAll() {
    return this.disputeService.getAll();
  }

  @MessagePattern('payment.get_open_dispute_count')
  getOpenCount() {
    return this.disputeService.getOpenCount();
  }

  @MessagePattern('payment.get_disputes_by_order')
  getByOrder(@Payload() data: OrderIdPayload) {
    return this.disputeService.getByOrder(data.order_id);
  }

  @MessagePattern('payment.get_disputes_by_buyer')
  getByBuyer(@Payload() data: BuyerPayload) {
    return this.disputeService.getByBuyer(data.buyer_id);
  }

  @MessagePattern('payment.update_dispute_status')
  updateStatus(@Payload() data: UpdateDisputeStatusPayload) {
    return this.disputeService.updateStatus(data.id, data.status);
  }

  @MessagePattern('payment.start_dispute_review')
  startReview(@Payload() data: IdPayload) {
    return this.disputeService.startReview(data.id);
  }

  @MessagePattern('payment.close_stripe_dispute')
  closeFromStripe(@Payload() data: CloseStripeDisputePayload) {
    return this.disputeService.closeFromStripe(data.stripe_dispute_id, data.won);
  }

  @MessagePattern('payment.resolve_dispute')
  resolve(@Payload() data: ResolveDisputePayload) {
    return this.disputeService.resolve(data.id, data);
  }
}
