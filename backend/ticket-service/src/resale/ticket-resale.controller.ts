import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketResaleService } from './ticket-resale.service';
import { CompleteResalePayload, EventIdPayload, IdPayload, ListResalesAdminPayload, OrderIdPayload, RequestResalePayload, ResaleBuyerPayload, ResaleIdPayload, TicketIdPayload, UserIdPayload } from '../common/payloads';

@Controller()
export class TicketResaleController {
  constructor(private readonly resaleService: TicketResaleService) {}

  @MessagePattern('ticket.request_resale')
  requestResale(@Payload() data: RequestResalePayload) {
    return this.resaleService.requestResale(data);
  }

  @MessagePattern('ticket.list_resale_by_event')
  listByEvent(@Payload() data: EventIdPayload) {
    return this.resaleService.listByEvent(data.event_id);
  }

  @MessagePattern('ticket.list_all_resale')
  listAllActive() {
    return this.resaleService.listAllActive();
  }

  @MessagePattern('ticket.get_resale')
  getById(@Payload() data: IdPayload) {
    return this.resaleService.getById(data.id);
  }

  @MessagePattern('ticket.get_active_resale_by_ticket')
  getActiveByTicketId(@Payload() data: TicketIdPayload) {
    return this.resaleService.getActiveByTicketId(data.ticket_id);
  }

  @MessagePattern('ticket.reserve_resale')
  reserve(@Payload() data: ResaleBuyerPayload) {
    return this.resaleService.reserve(data.resale_id, data.buyer_id);
  }

  @MessagePattern('ticket.release_resale_reservation')
  releaseReservation(@Payload() data: ResaleIdPayload) {
    return this.resaleService.releaseReservation(data.resale_id);
  }

  @MessagePattern('ticket.complete_resale')
  completeResale(@Payload() data: CompleteResalePayload) {
    return this.resaleService.completeResale(data);
  }

  @MessagePattern('ticket.resales_by_seller')
  listBySeller(@Payload() data: UserIdPayload) {
    return this.resaleService.listBySeller(data.user_id);
  }

  @MessagePattern('ticket.resales_bought_by')
  listBoughtBy(@Payload() data: UserIdPayload) {
    return this.resaleService.listBoughtBy(data.user_id);
  }

  @MessagePattern('ticket.resales_sold_from_order')
  listSoldFromOrder(@Payload() data: OrderIdPayload) {
    return this.resaleService.listSoldFromOrder(data.order_id);
  }

  @MessagePattern('ticket.resales_by_user')
  listByUser(@Payload() data: UserIdPayload) {
    return this.resaleService.listByUser(data.user_id);
  }

  @MessagePattern('ticket.list_resales_admin')
  listForAdmin(@Payload() data: ListResalesAdminPayload) {
    return this.resaleService.listForAdmin(data ?? {});
  }

  @MessagePattern('ticket.withdraw_resale')
  withdraw(@Payload() data: ResaleBuyerPayload) {
    return this.resaleService.withdraw(data);
  }
}
