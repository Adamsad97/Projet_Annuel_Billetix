import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('order.create')
  create(@Payload() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @MessagePattern('order.get')
  getById(@Payload() data: { id: string }) {
    return this.orderService.getById(data.id);
  }

  @MessagePattern('order.list_by_buyer')
  listByBuyer(@Payload() data: { buyer_id: string }) {
    return this.orderService.getByBuyer(data.buyer_id);
  }

  @MessagePattern('order.list_by_event')
  listByEvent(@Payload() data: { event_id: string }) {
    return this.orderService.getByEvent(data.event_id);
  }

  @MessagePattern('order.confirm_payment')
  confirmPayment(@Payload() data: { id: string; payment_intent_id: string; fees: number }) {
    return this.orderService.confirmPayment(data.id, data.payment_intent_id, data.fees);
  }

  @MessagePattern('order.mark_tickets_sent')
  markTicketsSent(@Payload() data: { id: string }) {
    return this.orderService.markTicketsSent(data.id);
  }

  @MessagePattern('order.cancel')
  cancel(@Payload() data: { id: string; reason?: string }) {
    return this.orderService.cancel(data.id, data.reason);
  }

  @MessagePattern('order.mark_refunded')
  markRefunded(@Payload() data: { id: string }) {
    return this.orderService.markRefunded(data.id);
  }

  @MessagePattern('order.set_invoice_url')
  setInvoiceUrl(@Payload() data: { id: string; url: string }) {
    return this.orderService.setInvoiceUrl(data.id, data.url);
  }
}
