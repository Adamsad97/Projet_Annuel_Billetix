import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { CreateOrderDto, CreateResaleOrderDto, ReserveStockDto } from './dto/create-order.dto';
import {
  BuyerPayload,
  CancelOrderPayload,
  ConfirmPaymentPayload,
  EventIdPayload,
  IdPayload,
  MarkRefundedPayload,
  RecentRefundsPayload,
  ReleaseReservationPayload,
  SalesTrendPayload,
  SetInvoiceUrlPayload,
} from './dto/order-payloads';
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
  releaseReservation(@Payload() data: ReleaseReservationPayload) {
    return this.reservationService.release(data.reservation_token);
  }

  @MessagePattern('order.create')
  create(@Payload() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @MessagePattern('order.create_resale')
  createResale(@Payload() dto: CreateResaleOrderDto) {
    return this.orderService.createFromResale(dto);
  }

  @MessagePattern('order.get')
  getById(@Payload() data: IdPayload) {
    return this.orderService.getById(data.id);
  }

  @MessagePattern('order.list_by_buyer')
  listByBuyer(@Payload() data: BuyerPayload) {
    return this.orderService.getByBuyer(data.buyer_id);
  }

  @MessagePattern('order.list_by_event')
  listByEvent(@Payload() data: EventIdPayload) {
    return this.orderService.getByEvent(data.event_id);
  }

  @MessagePattern('order.get_revenue_by_event')
  getRevenueByEvent(@Payload() data: EventIdPayload) {
    return this.orderService.getRevenueByEvent(data.event_id);
  }

  @MessagePattern('order.get_platform_revenue')
  getPlatformRevenue() {
    return this.orderService.getPlatformRevenue();
  }

  @MessagePattern('order.get_sales_trend')
  getSalesTrend(@Payload() data: SalesTrendPayload) {
    return this.orderService.getSalesTrend(new Date(data.from), new Date(data.to));
  }

  @MessagePattern('order.get_recent_refund_count')
  getRecentRefundCount(@Payload() data: RecentRefundsPayload) {
    return this.orderService.getRecentRefundCount(data.hours);
  }

  @MessagePattern('order.confirm_payment')
  confirmPayment(@Payload() data: ConfirmPaymentPayload) {
    return this.orderService.confirmPayment(data.id, data.payment_intent_id, data.fees);
  }

  @MessagePattern('order.mark_tickets_sent')
  markTicketsSent(@Payload() data: IdPayload) {
    return this.orderService.markTicketsSent(data.id);
  }

  @MessagePattern('order.cancel')
  cancel(@Payload() data: CancelOrderPayload) {
    return this.orderService.cancel(data.id, data.buyer_id, data.is_admin ?? false, data.reason);
  }

  @MessagePattern('order.mark_refunded')
  markRefunded(@Payload() data: MarkRefundedPayload) {
    return this.orderService.markRefunded(data.id, data.restore_stock ?? true);
  }

  @MessagePattern('order.set_invoice_url')
  setInvoiceUrl(@Payload() data: SetInvoiceUrlPayload) {
    return this.orderService.setInvoiceUrl(data.id, data.url);
  }
}
