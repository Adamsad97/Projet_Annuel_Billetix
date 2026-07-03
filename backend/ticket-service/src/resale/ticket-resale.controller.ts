import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketResaleService } from './ticket-resale.service';

@Controller()
export class TicketResaleController {
  constructor(private readonly resaleService: TicketResaleService) {}

  @MessagePattern('ticket.request_resale')
  requestResale(@Payload() data: {
    ticket_id: string;
    buyer_id: string;
    original_order_id: string;
    resale_price: number;
  }) {
    return this.resaleService.requestResale(data);
  }

  @MessagePattern('ticket.list_resale_by_event')
  listByEvent(@Payload() data: { event_id: string }) {
    return this.resaleService.listByEvent(data.event_id);
  }

  @MessagePattern('ticket.get_resale')
  getById(@Payload() data: { id: string }) {
    return this.resaleService.getById(data.id);
  }

  @MessagePattern('ticket.complete_resale')
  completeResale(@Payload() data: {
    resale_id: string;
    new_buyer_id: string;
    new_order_id: string;
  }) {
    return this.resaleService.completeResale(data);
  }

  @MessagePattern('ticket.withdraw_resale')
  withdraw(@Payload() data: { resale_id: string; buyer_id: string }) {
    return this.resaleService.withdraw(data);
  }
}
