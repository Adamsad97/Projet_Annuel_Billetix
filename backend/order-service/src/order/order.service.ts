import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus, PaymentStatus } from './order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly reservationService: StockReservationService,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async create(dto: CreateOrderDto): Promise<{ order: Order; items: OrderItem[] }> {
    const reservation = await this.reservationService.validate(dto.reservation_token, dto.buyer_id);
    const config = await this.platformConfig.get();

    return this.dataSource.transaction(async (manager) => {
      const discount = dto.discount_amount ?? 0;

      let subtotal_ht = 0;
      let free_ticket_fees = 0;
      const itemsData = dto.items.map((itemInput) => {
        const unit_ht = Number(itemInput.unit_price_ht);
        const unit_ttc = parseFloat((unit_ht * (1 + config.tva_rate)).toFixed(2));
        const total_ht = parseFloat((unit_ht * itemInput.quantity).toFixed(2));
        const total_ttc = parseFloat((unit_ttc * itemInput.quantity).toFixed(2));
        subtotal_ht += total_ht;
        if (unit_ht === 0) free_ticket_fees += config.free_ticket_fee_eur * itemInput.quantity;
        return {
          ticket_category_id: itemInput.ticket_category_id,
          ticket_category_name: itemInput.ticket_category_name ?? '',
          quantity: itemInput.quantity,
          unit_price_ht: unit_ht,
          unit_price_ttc: unit_ttc,
          total_price_ht: total_ht,
          total_price_ttc: total_ttc,
          holder_first_name: itemInput.holder_first_name,
          holder_last_name: itemInput.holder_last_name,
          seat_info: itemInput.seat_info ?? null,
        };
      });

      const total_ht = parseFloat((subtotal_ht - discount).toFixed(2));
      const total_ttc = parseFloat((total_ht * (1 + config.tva_rate) + free_ticket_fees).toFixed(2));
      const commission = parseFloat((total_ht * (dto.commission_rate / 100)).toFixed(2));
      const net_organizer = parseFloat((total_ht - commission).toFixed(2));
      free_ticket_fees = parseFloat(free_ticket_fees.toFixed(2));

      const order = manager.create(Order, {
        reference: this.generateReference(),
        buyer_id: dto.buyer_id,
        event_id: reservation.event_id,
        organizer_id: dto.organizer_id ?? null,
        event_name: dto.event_name,
        event_start_at: dto.event_start_at,
        event_end_at: dto.event_end_at ?? null,
        event_venue_name: dto.event_venue_name,
        event_venue_address: dto.event_venue_address,
        event_city: dto.event_city,
        event_poster_url: dto.event_poster_url ?? null,
        artist_name: dto.artist_name,
        artist_description: dto.artist_description ?? null,
        buyer_email: dto.billing_email,
        buyer_first_name: dto.billing_first_name,
        buyer_last_name: dto.billing_last_name,
        total_amount_ht: total_ht,
        total_amount_ttc: total_ttc,
        total_commission: commission,
        free_ticket_fees,
        total_payment_fees: 0,
        net_organizer_amount: net_organizer,
        promo_code_id: dto.promo_code_id ?? null,
        discount_amount: discount,
        billing_first_name: dto.billing_first_name,
        billing_last_name: dto.billing_last_name,
        billing_email: dto.billing_email,
        billing_address_line1: dto.billing_address_line1,
        billing_address_line2: dto.billing_address_line2 ?? null,
        billing_city: dto.billing_city,
        billing_postal_code: dto.billing_postal_code,
        billing_country: dto.billing_country,
        payment_method: dto.payment_method,
      });

      await manager.save(order);

      const items = await manager.save(
        itemsData.map((itemData) => manager.create(OrderItem, { ...itemData, order_id: order.id })),
      );

      // Consommer le token — la réservation est définitivement engagée
      await this.reservationService.consume(dto.reservation_token);

      return { order, items };
    });
  }

  async getById(id: string): Promise<{ order: Order; items: OrderItem[] }> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    const items = await this.itemRepo.find({ where: { order_id: id } });
    return { order, items };
  }

  async getByBuyer(buyerId: string): Promise<Order[]> {
    return this.orderRepo.find({ where: { buyer_id: buyerId }, order: { created_at: 'DESC' } });
  }

  async getByEvent(eventId: string): Promise<Order[]> {
    return this.orderRepo.find({ where: { event_id: eventId }, order: { created_at: 'DESC' } });
  }

  /** Revenu agrégé d'un événement — ne compte que les commandes réellement payées (exclut PENDING_PAYMENT/CANCELLED/REFUNDED). */
  async getRevenueByEvent(eventId: string): Promise<{
    orders_count: number;
    revenue_ht: number;
    revenue_ttc: number;
    total_commission: number;
    net_organizer_amount: number;
  }> {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders_count')
      .addSelect('COALESCE(SUM(o.total_amount_ht), 0)', 'revenue_ht')
      .addSelect('COALESCE(SUM(o.total_amount_ttc), 0)', 'revenue_ttc')
      .addSelect('COALESCE(SUM(o.total_commission), 0)', 'total_commission')
      .addSelect('COALESCE(SUM(o.net_organizer_amount), 0)', 'net_organizer_amount')
      .where('o.event_id = :eventId', { eventId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT],
      })
      .getRawOne<Record<string, string>>();

    return {
      orders_count: parseInt(row?.orders_count ?? '0', 10),
      revenue_ht: parseFloat(row?.revenue_ht ?? '0'),
      revenue_ttc: parseFloat(row?.revenue_ttc ?? '0'),
      total_commission: parseFloat(row?.total_commission ?? '0'),
      net_organizer_amount: parseFloat(row?.net_organizer_amount ?? '0'),
    };
  }

  async confirmPayment(id: string, paymentIntentId: string, fees: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });

    order.status = OrderStatus.CONFIRMED;
    order.payment_status = PaymentStatus.PAID;
    order.payment_intent_id = paymentIntentId;
    order.paid_at = new Date();
    order.total_payment_fees = fees;
    order.net_organizer_amount = parseFloat(
      (Number(order.net_organizer_amount) - fees).toFixed(2),
    );
    return this.orderRepo.save(order);
  }

  async markTicketsSent(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    order.status = OrderStatus.TICKETS_SENT;
    return this.orderRepo.save(order);
  }

  async cancel(id: string, reason?: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new RpcException({ statusCode: 400, message: 'Commande déjà annulée ou remboursée' });
    }
    order.status = OrderStatus.CANCELLED;
    order.cancelled_at = new Date();
    order.cancellation_reason = reason ?? null;
    return this.orderRepo.save(order);
  }

  async markRefunded(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    order.status = OrderStatus.REFUNDED;
    order.payment_status = PaymentStatus.REFUNDED;
    order.refunded_at = new Date();
    return this.orderRepo.save(order);
  }

  async setInvoiceUrl(id: string, url: string): Promise<Order> {
    await this.orderRepo.update(id, { invoice_url: url });
    return this.orderRepo.findOne({ where: { id } });
  }

  private generateReference(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${year}-${random}`;
  }
}
