import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { CreateOrderDto, ReserveStockDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly reservationService: StockReservationService,
  ) {}

  @MessagePattern('order.reserve_stock')
  reserveStock(@Payload() dto: ReserveStockDto) {
    return this.reservationService.reserve(dto.buyer_id, dto.event_id, dto.items);
  }

  @MessagePattern('order.release_reservation')
  releaseReservation(@Payload() data: { reservation_token: string }) {
    return this.reservationService.release(data.reservation_token);
  }

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

  @MessagePattern('order.get_revenue_by_event')
  getRevenueByEvent(@Payload() data: { event_id: string }) {
    return this.orderService.getRevenueByEvent(data.event_id);
  }

  @MessagePattern('order.get_platform_revenue')
  getPlatformRevenue() {
    return this.orderService.getPlatformRevenue();
  }

  @MessagePattern('order.get_revenue_trend')
  getRevenueTrend(@Payload() data: { days: number }) {
    return this.orderService.getRevenueTrend(data.days);
  }

  @MessagePattern('order.get_recent_refund_count')
  getRecentRefundCount(@Payload() data: { hours: number }) {
    return this.orderService.getRecentRefundCount(data.hours);
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
  cancel(@Payload() data: { id: string; buyer_id: string; is_admin?: boolean; reason?: string }) {
    return this.orderService.cancel(data.id, data.buyer_id, data.is_admin ?? false, data.reason);
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
