import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketService } from './ticket.service';
import { BuyerPayload, EventDatesPayload, EventIdPayload, GenerateTicketsPayload, IdPayload, InvalidateTicketPayload, MarkUsedPayload, OrderIdPayload, TransferToNewBuyerPayload, VerifyQrPayload } from '../common/payloads';

@Controller()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @MessagePattern('ticket.generate')
  generate(@Payload() dto: GenerateTicketsPayload) {
    return this.ticketService.generate(dto);
  }

  @MessagePattern('ticket.get_display_qr')
  getDisplayQr(@Payload() data: IdPayload) {
    return this.ticketService.getDisplayQr(data.id);
  }

  @MessagePattern('ticket.get')
  getById(@Payload() data: IdPayload) {
    return this.ticketService.getById(data.id);
  }

  @MessagePattern('ticket.get_by_buyer')
  getByBuyer(@Payload() data: BuyerPayload) {
    return this.ticketService.getByBuyer(data.buyer_id);
  }

  @MessagePattern('ticket.get_by_order')
  getByOrder(@Payload() data: OrderIdPayload) {
    return this.ticketService.getByOrder(data.order_id);
  }

  @MessagePattern('ticket.get_by_event')
  getByEvent(@Payload() data: EventIdPayload) {
    return this.ticketService.getByEvent(data.event_id);
  }

  @MessagePattern('ticket.get_stats_by_event')
  getStatsByEvent(@Payload() data: EventIdPayload) {
    return this.ticketService.getStatsByEvent(data.event_id);
  }

  @MessagePattern('ticket.verify_qr')
  verifyQr(@Payload() data: VerifyQrPayload) {
    return this.ticketService.verifyQr(data.token);
  }

  @MessagePattern('ticket.mark_sent')
  markSent(@Payload() data: OrderIdPayload) {
    return this.ticketService.markSent(data.order_id);
  }

  @MessagePattern('ticket.mark_used')
  markUsed(@Payload() data: MarkUsedPayload) {
    return this.ticketService.markUsed(data.id, data.agent_id, data.device_info);
  }

  @MessagePattern('ticket.cancel')
  cancel(@Payload() data: IdPayload) {
    return this.ticketService.cancel(data.id);
  }

  @MessagePattern('ticket.transfer_to_new_buyer')
  transferToNewBuyer(
    @Payload()
    data: TransferToNewBuyerPayload,
  ) {
    return this.ticketService.transferToNewBuyer(
      data.id,
      data.new_buyer_id,
      data.new_order_id,
      data.new_buyer_email,
      data.new_holder_first_name,
      data.new_holder_last_name,
    );
  }

  @MessagePattern('ticket.invalidate')
  invalidate(@Payload() data: InvalidateTicketPayload) {
    return this.ticketService.invalidate(data.id, data.admin_id, data.reason);
  }

  @MessagePattern('ticket.cancel_by_event')
  cancelByEvent(@Payload() data: EventIdPayload) {
    return this.ticketService.cancelByEvent(data.event_id);
  }

  @MessagePattern('ticket.cancel_by_order')
  cancelByOrder(@Payload() data: OrderIdPayload) {
    return this.ticketService.cancelByOrder(data.order_id);
  }

  @MessagePattern('ticket.sync_event_dates')
  syncEventDates(@Payload() data: EventDatesPayload) {
    return this.ticketService.syncEventDates(data.event_id, new Date(data.event_start_at), new Date(data.event_end_at));
  }
}
