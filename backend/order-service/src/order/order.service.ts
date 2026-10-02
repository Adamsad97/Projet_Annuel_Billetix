import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';
import { DataSource, In, Not, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { CreateOrderDto, CreateResaleOrderDto } from './dto/create-order.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus, PaymentMethod, PaymentStatus } from './order.entity';

/** Taux de TVA de l'événement (fraction) ; 20 % pour un événement antérieur à la liste. */
function vatRateOf(event: { vat_rate?: string | number | null }): number {
  const rate = Number(event.vat_rate);
  return Number.isFinite(rate) && event.vat_rate !== null && event.vat_rate !== undefined ? rate : 0.2;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mêmes quantités par catégorie, quel que soit le découpage en lignes (un titulaire par ligne). */
function sameQuantities(
  ordered: Array<{ ticket_category_id: string; quantity: number }>,
  reserved: Array<{ ticket_category_id: string; quantity: number }>,
): boolean {
  const totals = (items: typeof ordered) =>
    items.reduce((map, item) => map.set(item.ticket_category_id, (map.get(item.ticket_category_id) ?? 0) + item.quantity), new Map<string, number>());
  const a = totals(ordered);
  const b = totals(reserved);
  return a.size === b.size && [...a].every(([categoryId, quantity]) => b.get(categoryId) === quantity);
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly reservationService: StockReservationService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientProxy,
  ) {}

  async create(dto: CreateOrderDto): Promise<{ order: Order; items: OrderItem[] }> {
    const reservation = await this.reservationService.validate(dto.reservation_token, dto.buyer_id);

    // Les infos d'événement (organisateur, nom, lieu) sont relues par la passerelle
    // depuis dto.event_id : il doit être celui de la réservation.
    if (dto.event_id !== reservation.event_id) {
      throw new RpcException({ statusCode: 400, message: "La commande ne correspond pas à l'événement réservé." });
    }
    // Seul le stock réservé a été décompté (quota, maximum par commande, dates de
    // vente) : la commande doit reprendre exactement les mêmes billets.
    if (!sameQuantities(dto.items, reservation.items)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Les billets de la commande ne correspondent pas à ceux réservés — veuillez recommencer.',
      });
    }

    const config = await this.platformConfig.get();

    // Taux de commission jamais fourni par le client : relu depuis l'événement.
    const event = await firstValueFrom(
      this.eventClient.send<{ commission_rate: number; organizer_id: string; vat_rate?: string }>('event.get', {
        id: reservation.event_id,
      }),
    );
    const commission_rate = Number(event.commission_rate);
    // Taux de TVA de l'événement (choisi dans la liste de l'admin), recopié
    // sur la commande : factures et avoirs le reprennent tel quel.
    const vat_rate = vatRateOf(event);

    // Un organisateur ne peut pas acheter de billet pour son propre événement (organizer_id relu depuis l'événement).
    if (event.organizer_id === dto.buyer_id) {
      await this.reservationService.release(dto.reservation_token);
      throw new RpcException({
        statusCode: 403,
        message: 'Un organisateur ne peut pas acheter de billet pour son propre événement',
      });
    }

    // Prix et nom relus depuis les catégories réelles de l'événement, jamais depuis le client.
    const categories = await firstValueFrom(
      this.eventClient.send<Array<{ id: string; name: string; price_ht: number }>>(
        'event.get_categories',
        { event_id: reservation.event_id },
      ),
    );
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    // Remise recalculée ici à partir du seul code promo saisi par l'acheteur.
    let validatedPromo: {
      discount_type: 'PERCENTAGE' | 'FIXED';
      discount_value: number;
      promo_code_id: string;
    } | null = null;
    if (dto.promo_code) {
      const result = await firstValueFrom(
        this.eventClient.send<{
          valid: boolean;
          message?: string;
          discount_type?: 'PERCENTAGE' | 'FIXED';
          discount_value?: number;
          promo_code_id?: string;
        }>('event.validate_promo_code', {
          event_id: reservation.event_id,
          code: dto.promo_code,
        }),
      );
      if (!result.valid) {
        throw new RpcException({
          statusCode: 400,
          message: result.message ?? 'Code promo invalide',
        });
      }
      validatedPromo = {
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value),
        promo_code_id: result.promo_code_id,
      };
    }

    const { order, items } = await this.dataSource.transaction(async (manager) => {
      let subtotal_ht = 0;
      let free_ticket_fees = 0;
      const itemsData = dto.items.map((itemInput) => {
        const category = categoryById.get(itemInput.ticket_category_id);
        if (!category) {
          throw new RpcException({
            statusCode: 400,
            message: 'Catégorie de billet invalide ou inactive pour cet événement',
          });
        }

        const unit_ht = Number(category.price_ht);
        const unit_ttc = parseFloat((unit_ht * (1 + vat_rate)).toFixed(2));
        const total_ht = parseFloat((unit_ht * itemInput.quantity).toFixed(2));
        const total_ttc = parseFloat((unit_ttc * itemInput.quantity).toFixed(2));
        subtotal_ht += total_ht;
        if (unit_ht === 0) free_ticket_fees += config.free_ticket_fee_eur * itemInput.quantity;
        return {
          ticket_category_id: itemInput.ticket_category_id,
          ticket_category_name: category.name,
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

      const discount = validatedPromo
        ? validatedPromo.discount_type === 'PERCENTAGE'
          ? parseFloat((subtotal_ht * (validatedPromo.discount_value / 100)).toFixed(2))
          : Math.min(validatedPromo.discount_value, subtotal_ht)
        : 0;

      const total_ht = parseFloat((subtotal_ht - discount).toFixed(2));
      // Les frais par billet gratuit sont à la charge de l'organisateur, jamais de l'acheteur.
      const total_ttc = parseFloat((total_ht * (1 + vat_rate)).toFixed(2));
      const commission = parseFloat((total_ht * (commission_rate / 100)).toFixed(2));
      free_ticket_fees = parseFloat(free_ticket_fees.toFixed(2));
      const net_organizer = parseFloat((total_ht - commission - free_ticket_fees).toFixed(2));

      // Réservation gratuite : aucun moyen de paiement, adresse facultative ; payante : adresse complète, « gratuit » refusé.
      const isFree = total_ttc === 0;
      const hasAddress = [dto.billing_address_line1, dto.billing_city, dto.billing_postal_code, dto.billing_country].every(
        (field) => typeof field === 'string' && field.trim() !== '',
      );
      if (!isFree && !hasAddress) {
        throw new RpcException({ statusCode: 400, message: "L'adresse de facturation complète est obligatoire." });
      }
      if (!isFree && dto.payment_method === PaymentMethod.FREE) {
        throw new RpcException({ statusCode: 400, message: 'Cette commande est payante : choisissez un moyen de paiement.' });
      }

      const order = manager.create(Order, {
        reference: this.generateReference(),
        buyer_id: dto.buyer_id,
        event_id: reservation.event_id,
        vat_rate: vat_rate.toFixed(4),
        // Relu depuis l'événement réservé : c'est lui qui reçoit le reversement.
        organizer_id: event.organizer_id ?? null,
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
        promo_code_id: validatedPromo?.promo_code_id ?? null,
        discount_amount: discount,
        billing_first_name: dto.billing_first_name,
        billing_last_name: dto.billing_last_name,
        billing_email: dto.billing_email,
        billing_address_line1: dto.billing_address_line1?.trim() || null,
        billing_address_line2: dto.billing_address_line2 ?? null,
        billing_city: dto.billing_city?.trim() || null,
        billing_postal_code: dto.billing_postal_code?.trim() || null,
        billing_country: dto.billing_country?.trim() || null,
        payment_method: isFree ? PaymentMethod.FREE : dto.payment_method,
      });

      await manager.save(order);

      const items = await manager.save(
        itemsData.map((itemData) => manager.create(OrderItem, { ...itemData, order_id: order.id })),
      );

      // Consommer le token — la réservation est définitivement engagée
      await this.reservationService.consume(dto.reservation_token);

      return { order, items };
    });

    // Incrémentation de l'usage du code promo une fois la commande engagée
    // (fire-and-forget — un échec ici ne doit pas faire échouer la commande).
    if (validatedPromo) {
      this.eventClient
        .send('event.increment_promo_uses', { id: validatedPromo.promo_code_id })
        .subscribe({ error: () => undefined });
    }

    return { order, items };
  }

  /** Achat en revente : pas de réservation de stock, prix de l'offre et commission relus depuis les services. */
  async createFromResale(dto: CreateResaleOrderDto): Promise<{ order: Order; items: OrderItem[] }> {
    // Réserve atomiquement l'offre (LISTED → RESERVED) le temps du paiement.
    const resale = await firstValueFrom(
      this.ticketClient.send<{
        id: string;
        status: string;
        resale_price: number;
        event_id: string;
        ticket_category_id: string;
        original_buyer_id: string;
      }>('ticket.reserve_resale', { resale_id: dto.resale_id, buyer_id: dto.buyer_id }),
    );

    // Le vendeur ne peut pas racheter son propre billet : on libère aussitôt la réservation.
    if (resale.original_buyer_id === dto.buyer_id) {
      this.ticketClient
        .send('ticket.release_resale_reservation', { resale_id: dto.resale_id })
        .subscribe({ error: () => undefined });
      throw new RpcException({
        statusCode: 400,
        message: 'Vous ne pouvez pas racheter votre propre billet mis en revente — retirez-le de la vente si vous avez changé d\'avis.',
      });
    }

    const event = await firstValueFrom(
      this.eventClient.send<{
        commission_rate: number;
        title: string;
        start_date: string;
        end_date: string;
        venue_name: string;
        venue_address_line1: string;
        venue_city: string;
        poster_url: string;
        organizer_id: string;
        vat_rate?: string;
      }>('event.get', { id: resale.event_id }),
    );
    const commission_rate = Number(event.commission_rate);
    const vat_rate = vatRateOf(event);

    // Nom de catégorie seulement informatif : une catégorie désactivée n'empêche pas la revente.
    let categoryName = 'Billet revendu';
    try {
      const categories = await firstValueFrom(
        this.eventClient.send<Array<{ id: string; name: string }>>('event.get_categories', {
          event_id: resale.event_id,
        }),
      );
      categoryName = categories.find((category) => category.id === resale.ticket_category_id)?.name ?? categoryName;
    } catch {
      // non bloquant
    }

    // resale_price est déjà le prix TTC plafonné : le HT en est dérivé par calcul inverse.
    const unit_ttc = Number(resale.resale_price);
    const unit_ht = parseFloat((unit_ttc / (1 + vat_rate)).toFixed(2));
    const commission = parseFloat((unit_ht * (commission_rate / 100)).toFixed(2));
    const net_organizer = parseFloat((unit_ht - commission).toFixed(2));

    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        reference: this.generateReference(),
        buyer_id: dto.buyer_id,
        event_id: resale.event_id,
        vat_rate: vat_rate.toFixed(4),
        is_resale: true,
        resale_id: dto.resale_id,
        organizer_id: event.organizer_id ?? null,
        event_name: event.title ?? null,
        event_start_at: event.start_date ?? null,
        event_end_at: event.end_date ?? null,
        event_venue_name: event.venue_name ?? null,
        event_venue_address: event.venue_address_line1 ?? null,
        event_city: event.venue_city ?? null,
        event_poster_url: event.poster_url ?? null,
        buyer_email: dto.billing_email,
        buyer_first_name: dto.billing_first_name,
        buyer_last_name: dto.billing_last_name,
        total_amount_ht: unit_ht,
        total_amount_ttc: unit_ttc,
        total_commission: commission,
        free_ticket_fees: 0,
        total_payment_fees: 0,
        net_organizer_amount: net_organizer,
        promo_code_id: null,
        discount_amount: 0,
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

      const items = await manager.save([
        manager.create(OrderItem, {
          order_id: order.id,
          ticket_category_id: resale.ticket_category_id,
          ticket_category_name: categoryName,
          quantity: 1,
          unit_price_ht: unit_ht,
          unit_price_ttc: unit_ttc,
          total_price_ht: unit_ht,
          total_price_ttc: unit_ttc,
          holder_first_name: dto.billing_first_name,
          holder_last_name: dto.billing_last_name,
          seat_info: null,
        }),
      ]);

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

  /** Événement reporté : les commandes suivent la nouvelle date (tri et affichage de « Mes commandes »). */
  async syncEventDates(eventId: string, startAt: Date, endAt: Date): Promise<{ updated: number }> {
    const result = await this.orderRepo.update({ event_id: eventId }, { event_start_at: startAt, event_end_at: endAt });
    return { updated: result.affected ?? 0 };
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
      // Part remboursée d'une commande (billet revendu) déduite au prorata :
      // le billet est compté dans la commande de revente, pas deux fois.
      .addSelect('COALESCE(SUM(o.total_amount_ht * COALESCE((1 - COALESCE(o.refunded_amount, 0) / NULLIF(o.total_amount_ttc, 0)), 1)), 0)', 'revenue_ht')
      .addSelect('COALESCE(SUM(o.total_amount_ttc - COALESCE(o.refunded_amount, 0)), 0)', 'revenue_ttc')
      .addSelect('COALESCE(SUM(o.total_commission * COALESCE((1 - COALESCE(o.refunded_amount, 0) / NULLIF(o.total_amount_ttc, 0)), 1)), 0)', 'total_commission')
      .addSelect('COALESCE(SUM(o.net_organizer_amount * COALESCE((1 - COALESCE(o.refunded_amount, 0) / NULLIF(o.total_amount_ttc, 0)), 1)), 0)', 'net_organizer_amount')
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

  /** Revenu agrégé toute la plateforme — mêmes règles que getRevenueByEvent, sans filtre event_id. */
  async getPlatformRevenue(): Promise<{
    orders_count: number;
    revenue_ht: number;
    revenue_ttc: number;
    total_commission: number;
  }> {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orders_count')
      .addSelect('COALESCE(SUM(o.total_amount_ht * COALESCE((1 - COALESCE(o.refunded_amount, 0) / NULLIF(o.total_amount_ttc, 0)), 1)), 0)', 'revenue_ht')
      .addSelect('COALESCE(SUM(o.total_amount_ttc - COALESCE(o.refunded_amount, 0)), 0)', 'revenue_ttc')
      .addSelect('COALESCE(SUM(o.total_commission * COALESCE((1 - COALESCE(o.refunded_amount, 0) / NULLIF(o.total_amount_ttc, 0)), 1)), 0)', 'total_commission')
      .where('o.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT],
      })
      .getRawOne<Record<string, string>>();

    return {
      orders_count: parseInt(row?.orders_count ?? '0', 10),
      revenue_ht: parseFloat(row?.revenue_ht ?? '0'),
      revenue_ttc: parseFloat(row?.revenue_ttc ?? '0'),
      total_commission: parseFloat(row?.total_commission ?? '0'),
    };
  }

  /** Tendance quotidienne (ventes, billets, CA) sur une plage : deux agrégats recombinés par FULL OUTER JOIN pour ne pas fausser les sommes. */
  async getSalesTrend(
    from: Date,
    to: Date,
  ): Promise<Array<{ day: string; orders_count: number; tickets_count: number; revenue_ttc: number }>> {
    const rows = await this.dataSource.query(
      `
      WITH orders_agg AS (
        SELECT date_trunc('day', paid_at) AS day,
               COUNT(*) AS orders_count,
               COALESCE(SUM(total_amount_ttc - COALESCE(refunded_amount, 0)), 0) AS revenue_ttc
        FROM orders.orders
        WHERE status IN ('CONFIRMED', 'TICKETS_SENT') AND paid_at >= $1 AND paid_at <= $2
        GROUP BY date_trunc('day', paid_at)
      ),
      items_agg AS (
        SELECT date_trunc('day', o.paid_at) AS day,
               COALESCE(SUM(oi.quantity), 0) AS tickets_count
        FROM orders.orders o
        JOIN orders.order_items oi ON oi.order_id = o.id::text
        WHERE o.status IN ('CONFIRMED', 'TICKETS_SENT') AND o.paid_at >= $1 AND o.paid_at <= $2
        GROUP BY date_trunc('day', o.paid_at)
      )
      SELECT to_char(COALESCE(orders_agg.day, items_agg.day), 'YYYY-MM-DD') AS day,
             COALESCE(orders_agg.orders_count, 0) AS orders_count,
             COALESCE(items_agg.tickets_count, 0) AS tickets_count,
             COALESCE(orders_agg.revenue_ttc, 0) AS revenue_ttc
      FROM orders_agg
      FULL OUTER JOIN items_agg ON orders_agg.day = items_agg.day
      ORDER BY day ASC
      `,
      [from, to],
    ) as Array<{ day: string; orders_count: string; tickets_count: string; revenue_ttc: string }>;

    return rows.map((row) => ({
      day: row.day,
      orders_count: parseInt(row.orders_count, 10),
      tickets_count: parseInt(row.tickets_count, 10),
      revenue_ttc: parseFloat(row.revenue_ttc),
    }));
  }

  /** Nombre de commandes remboursées sur une fenêtre récente — base du signal "remboursements massifs". */
  async getRecentRefundCount(hours: number): Promise<number> {
    const count = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.REFUNDED })
      .andWhere("o.refunded_at >= now() - (:hours || ' hours')::interval", {
        hours,
      })
      .getCount();
    return count;
  }

  async confirmPayment(id: string, paymentIntentId: string, fees: number): Promise<Order> {
    return this.confirmPaymentOnce(id, paymentIntentId, fees, true);
  }

  /** Bascule conditionnelle (statut relu inchangé) : un abandon simultané fait rejouer une fois, sur la commande annulée. */
  private async confirmPaymentOnce(id: string, paymentIntentId: string, fees: number, retry: boolean): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });

    // Défense en profondeur : ne jamais soustraire les frais deux fois.
    if (order.payment_status === PaymentStatus.PAID) {
      return order;
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.CANCELLED) {
      throw new RpcException({ statusCode: 409, message: `Paiement reçu pour une commande à l'état ${order.status}` });
    }

    // Paiement arrivé après l'abandon automatique : le stock a déjà été remis en
    // vente, il faut le reprendre avant d'émettre les billets.
    const items = order.status === OrderStatus.CANCELLED ? await this.retakeCancelledStock(order) : null;

    const changes = {
      status: OrderStatus.CONFIRMED,
      payment_status: PaymentStatus.PAID,
      payment_intent_id: paymentIntentId,
      paid_at: new Date(),
      total_payment_fees: fees,
      net_organizer_amount: parseFloat((Number(order.net_organizer_amount) - fees).toFixed(2)),
      cancelled_at: null,
      cancellation_reason: null,
    };
    const result = await this.orderRepo.update(
      { id, status: order.status, payment_status: Not(PaymentStatus.PAID) },
      changes,
    );
    if (!result.affected) {
      if (items) await this.reservationService.restoreItems(items);
      if (retry) return this.confirmPaymentOnce(id, paymentIntentId, fees, false);
      throw new RpcException({ statusCode: 409, message: "La commande a changé d'état pendant la confirmation du paiement" });
    }
    return Object.assign(order, changes);
  }

  /** 409 si les places sont reparties entre-temps : le paiement devra être remboursé. */
  private async retakeCancelledStock(order: Order): Promise<Array<{ ticket_category_id: string; quantity: number }>> {
    if (order.is_resale) {
      throw new RpcException({
        statusCode: 409,
        message: "Paiement reçu après l'annulation de la commande de revente : l'offre a été libérée, remboursement nécessaire.",
      });
    }
    const items = (await this.itemRepo.find({ where: { order_id: order.id } })).map((item) => ({
      ticket_category_id: item.ticket_category_id,
      quantity: item.quantity,
    }));
    try {
      await this.reservationService.retakeItems(items);
    } catch {
      throw new RpcException({
        statusCode: 409,
        message: "Paiement reçu après l'annulation de la commande et plus assez de places : remboursement nécessaire.",
      });
    }
    return items;
  }

  /** Sans effet si la commande n'est plus confirmée (remboursée entre-temps, ou déjà marquée). */
  async markTicketsSent(id: string): Promise<Order> {
    await this.orderRepo.update({ id, status: OrderStatus.CONFIRMED }, { status: OrderStatus.TICKETS_SENT });
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    return order;
  }

  async cancel(id: string, buyerId: string, isAdmin: boolean, reason?: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    if (!isAdmin && order.buyer_id !== buyerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new RpcException({ statusCode: 400, message: 'Commande déjà annulée ou remboursée' });
    }
    // Une commande payée passe par le remboursement, pas par une simple annulation.
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new RpcException({
        statusCode: 400,
        message: 'Seule une commande en attente de paiement peut être annulée — utilisez le remboursement pour une commande déjà payée',
      });
    }

    // Bascule conditionnelle : face à un abandon automatique ou un paiement
    // simultané, une seule opération l'emporte et le stock n'est rendu qu'une fois.
    const changes = { status: OrderStatus.CANCELLED, cancelled_at: new Date(), cancellation_reason: reason ?? null };
    const result = await this.orderRepo.update({ id, status: OrderStatus.PENDING_PAYMENT }, changes);
    if (!result.affected) {
      throw new RpcException({ statusCode: 409, message: "La commande vient de changer d'état — rechargez la page." });
    }
    const saved = Object.assign(order, changes);

    // Commande de revente : on libère la réservation de l'offre, pas un quota de catégorie.
    if (order.is_resale) {
      if (order.resale_id) {
        this.ticketClient
          .send('ticket.release_resale_reservation', { resale_id: order.resale_id })
          .subscribe({ error: () => undefined });
      }
    } else {
      const items = await this.itemRepo.find({ where: { order_id: id } });
      await this.reservationService.restoreItems(
        items.map((item) => ({ ticket_category_id: item.ticket_category_id, quantity: item.quantity })),
      );
    }

    return saved;
  }

  /** Annule les commandes en attente de paiement au-delà du délai et libère leur stock (OrderCleanupService). */
  async releaseAbandoned(): Promise<number> {
    const { order_abandon_timeout_minutes, resale_reservation_minutes } = await this.platformConfig.get();
    const threshold = new Date(Date.now() - order_abandon_timeout_minutes * 60 * 1000);
    // Commande de revente abandonnée au même rythme que la réservation de l'offre côté ticket-service.
    const resaleThreshold = new Date(Date.now() - resale_reservation_minutes * 60 * 1000);

    const abandoned = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.PENDING_PAYMENT })
      .andWhere(
        '(o.is_resale = false AND o.created_at < :threshold) OR (o.is_resale = true AND o.created_at < :resaleThreshold)',
        { threshold, resaleThreshold },
      )
      .getMany();

    let released = 0;
    for (const order of abandoned) {
      // Payée ou annulée entre-temps : rien à libérer.
      const result = await this.orderRepo.update(
        { id: order.id, status: OrderStatus.PENDING_PAYMENT },
        {
          status: OrderStatus.CANCELLED,
          cancelled_at: new Date(),
          cancellation_reason: 'Abandon automatique (délai de paiement dépassé)',
        },
      );
      if (!result.affected) continue;
      released++;

      if (order.is_resale) {
        if (order.resale_id) {
          this.ticketClient
            .send('ticket.release_resale_reservation', { resale_id: order.resale_id })
            .subscribe({ error: () => undefined });
        }
      } else {
        const items = await this.itemRepo.find({ where: { order_id: order.id } });
        await this.reservationService.restoreItems(
          items.map((item) => ({ ticket_category_id: item.ticket_category_id, quantity: item.quantity })),
        );
      }
    }

    return released;
  }

  /** restoreStock=false pour un remboursement dû à une revente : la place reste occupée par l'acheteur. */
  async markRefunded(id: string, restoreStock = true): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });

    // Idempotent : un second appel ne restaure pas le stock une deuxième fois.
    if (order.status === OrderStatus.REFUNDED) {
      return order;
    }

    // Webhook et action admin simultanés : un seul passage restaure le stock.
    const changes = { status: OrderStatus.REFUNDED, payment_status: PaymentStatus.REFUNDED, refunded_at: new Date() };
    const result = await this.orderRepo.update({ id, status: Not(In([OrderStatus.REFUNDED, OrderStatus.CANCELLED])) }, changes);
    if (!result.affected) {
      return (await this.orderRepo.findOne({ where: { id } })) ?? order;
    }
    const saved = Object.assign(order, changes);

    // Remboursement complet : restaure le stock, sauf pour une revente.
    if (!order.is_resale && restoreStock) {
      const items = await this.itemRepo.find({ where: { order_id: id } });
      await this.reservationService.restoreItems(
        items.map((item) => ({ ticket_category_id: item.ticket_category_id, quantity: item.quantity })),
      );
    }

    return saved;
  }

  /** Remboursement partiel sans annulation (billet revendu) : seul le montant est enregistré et déduit du CA. */
  async recordPartialRefund(id: string, amountTtc: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    const already = Number(order.refunded_amount ?? 0);
    const total = Number(order.total_amount_ttc);
    if (amountTtc <= 0 || already + amountTtc > total + 0.01) {
      throw new RpcException({
        statusCode: 400,
        message: `Montant de remboursement invalide (déjà remboursé : ${already} €, total : ${total} €)`,
      });
    }
    order.refunded_amount = parseFloat((already + amountTtc).toFixed(2));
    return this.orderRepo.save(order);
  }

  async setInvoiceUrl(id: string, url: string): Promise<Order> {
    await this.orderRepo.update(id, { invoice_url: url });
    return this.orderRepo.findOne({ where: { id } });
  }

  /** 8 caractères tirés au hasard cryptographique (32⁸ ≈ 10¹² combinaisons), sans 0/O ni 1/I. */
  private generateReference(): string {
    const year = new Date().getFullYear();
    const random = [...randomBytes(8)].map((byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join('');
    return `ORD-${year}-${random}`;
  }
}
