import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DisputeService } from './dispute.service';
import { DisputeReason, DisputeStatus } from './dispute.entity';

@Controller()
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @MessagePattern('payment.create_dispute')
  create(@Payload() data: {
    payment_id: string;
    order_id: string;
    buyer_id: string;
    reason: DisputeReason;
    description?: string;
    stripe_dispute_id?: string;
  }) {
    return this.disputeService.create(data);
  }

  @MessagePattern('payment.get_dispute')
  getById(@Payload() data: { id: string }) {
    return this.disputeService.getById(data.id);
  }

  @MessagePattern('payment.get_disputes_by_order')
  getByOrder(@Payload() data: { order_id: string }) {
    return this.disputeService.getByOrder(data.order_id);
  }

  @MessagePattern('payment.get_disputes_by_buyer')
  getByBuyer(@Payload() data: { buyer_id: string }) {
    return this.disputeService.getByBuyer(data.buyer_id);
  }

  @MessagePattern('payment.update_dispute_status')
  updateStatus(@Payload() data: { id: string; status: DisputeStatus }) {
    return this.disputeService.updateStatus(data.id, data.status);
  }

  @MessagePattern('payment.resolve_dispute')
  resolve(@Payload() data: {
    id: string;
    status: DisputeStatus.WON | DisputeStatus.LOST | DisputeStatus.CLOSED;
    resolved_by: string;
    resolution_notes?: string;
  }) {
    return this.disputeService.resolve(data.id, data);
  }
}
