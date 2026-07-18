import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { StockReservationService } from '../reservation/stock-reservation.service';
import { CreateOrderDto, CreateResaleOrderDto } from './dto/create-order.dto';
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
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientProxy,
  ) {}

  async create(dto: CreateOrderDto): Promise<{ order: Order; items: OrderItem[] }> {
    const reservation = await this.reservationService.validate(dto.reservation_token, dto.buyer_id);
    const config = await this.platformConfig.get();

    // Le taux de commission ne vient JAMAIS du client : il est relu depuis
    // l'événement, seule source de vérité, calculé dynamiquement côté
    // event-service à partir des réglages admin (platform_settings) — un
    // acheteur ne peut donc jamais imposer un taux de son choix (ex: 0%).
    const event = await firstValueFrom(
      this.eventClient.send<{ commission_rate: number }>('event.get', {
        id: reservation.event_id,
      }),
    );
    const commission_rate = Number(event.commission_rate);

    // Prix unitaire : jamais accepté depuis le client — relu depuis les
    // catégories de billets réelles de l'événement (event-service), seule
    // source de vérité pour price_ht/name. Un acheteur ne peut donc jamais
    // imposer son propre prix ou usurper le nom d'une catégorie.
    const categories = await firstValueFrom(
      this.eventClient.send<Array<{ id: string; name: string; price_ht: number }>>(
        'event.get_categories',
        { event_id: reservation.event_id },
      ),
    );
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    // Remise : jamais de discount_amount/promo_code_id fournis par le client
    // — seul le code (chaîne saisie par l'acheteur) est accepté, revalidé et
    // recalculé ici via event-service (mêmes règles que pour la commission).
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
        const unit_ttc = parseFloat((unit_ht * (1 + config.tva_rate)).toFixed(2));
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
      const total_ttc = parseFloat((total_ht * (1 + config.tva_rate) + free_ticket_fees).toFixed(2));
      const commission = parseFloat((total_ht * (commission_rate / 100)).toFixed(2));
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
        promo_code_id: validatedPromo?.promo_code_id ?? null,
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

    // Incrémentation de l'usage du code promo une fois la commande engagée
    // (fire-and-forget — un échec ici ne doit pas faire échouer la commande).
    if (validatedPromo) {
      this.eventClient
        .send('event.increment_promo_uses', { id: validatedPromo.promo_code_id })
        .subscribe({ error: () => undefined });
    }

    return { order, items };
  }

  /**
   * Achat d'un billet en revente (marché secondaire). Distinct de create() :
   * aucune réservation de stock (le billet existe déjà, aucune place n'est
   * décomptée) et le prix payé est celui de l'offre de revente — jamais celui
   * de la catégorie d'origine, jamais fourni par le client. Tout est relu
   * depuis ticket-service (l'offre) et event-service (le taux de commission).
   */
  async createFromResale(dto: CreateResaleOrderDto): Promise<{ order: Order; items: OrderItem[] }> {
    // Réserve atomiquement l'offre (statut LISTED -> RESERVED) le temps du
    // paiement — un second acheteur ne peut plus créer de commande sur la
    // même offre tant que celle-ci n'est pas libérée (paiement échoué/annulé)
    // ou expirée (voir ResaleCleanupService côté ticket-service).
    const resale = await firstValueFrom(
      this.ticketClient.send<{
        id: string;
        status: string;
        resale_price: number;
        event_id: string;
        ticket_category_id: string;
      }>('ticket.reserve_resale', { resale_id: dto.resale_id, buyer_id: dto.buyer_id }),
    );

    const config = await this.platformConfig.get();

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
      }>('event.get', { id: resale.event_id }),
    );
    const commission_rate = Number(event.commission_rate);

    // Best-effort : le nom de catégorie n'est qu'informatif (facture/email),
    // jamais utilisé pour le prix — une catégorie désactivée après la vente
    // d'origine ne doit pas empêcher la revente.
    let categoryName = 'Billet revendu';
    try {
      const categories = await firstValueFrom(
        this.eventClient.send<Array<{ id: string; name: string }>>('event.get_categories', {
          event_id: resale.event_id,
        }),
      );
      categoryName = categories.find((c) => c.id === resale.ticket_category_id)?.name ?? categoryName;
    } catch {
      // non bloquant
    }

    const unit_ht = Number(resale.resale_price);
    const unit_ttc = parseFloat((unit_ht * (1 + config.tva_rate)).toFixed(2));
    const commission = parseFloat((unit_ht * (commission_rate / 100)).toFixed(2));
    const net_organizer = parseFloat((unit_ht - commission).toFixed(2));

    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        reference: this.generateReference(),
        buyer_id: dto.buyer_id,
        event_id: resale.event_id,
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
      .addSelect('COALESCE(SUM(o.total_amount_ht), 0)', 'revenue_ht')
      .addSelect('COALESCE(SUM(o.total_amount_ttc), 0)', 'revenue_ttc')
      .addSelect('COALESCE(SUM(o.total_commission), 0)', 'total_commission')
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

  /** Tendance de revenu par jour sur les N derniers jours (paid_at — reflète l'encaissement réel). */
  async getRevenueTrend(
    days: number,
  ): Promise<Array<{ day: string; orders_count: number; revenue_ttc: number }>> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select("to_char(date_trunc('day', o.paid_at), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'orders_count')
      .addSelect('COALESCE(SUM(o.total_amount_ttc), 0)', 'revenue_ttc')
      .where('o.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT],
      })
      .andWhere("o.paid_at >= now() - (:days || ' days')::interval", { days })
      .groupBy("date_trunc('day', o.paid_at)")
      .orderBy("date_trunc('day', o.paid_at)", 'ASC')
      .getRawMany<{ day: string; orders_count: string; revenue_ttc: string }>();

    return rows.map((row) => ({
      day: row.day,
      orders_count: parseInt(row.orders_count, 10),
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
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });

    // Défense en profondeur : payment-service garantit déjà qu'un webhook
    // Stripe dupliqué ne rappelle jamais confirmPayment() deux fois, mais si
    // c'était le cas, ne jamais soustraire les frais une seconde fois.
    if (order.payment_status === PaymentStatus.PAID) {
      return order;
    }

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

  async cancel(id: string, buyerId: string, isAdmin: boolean, reason?: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new RpcException({ statusCode: 404, message: 'Commande introuvable' });
    if (!isAdmin && order.buyer_id !== buyerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new RpcException({ statusCode: 400, message: 'Commande déjà annulée ou remboursée' });
    }
    // Une commande déjà payée doit passer par le remboursement (admin), pas
    // par une simple annulation — sinon l'argent encaissé ne serait jamais
    // rendu tout en libérant le stock comme si de rien n'était.
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new RpcException({
        statusCode: 400,
        message: 'Seule une commande en attente de paiement peut être annulée — utilisez le remboursement pour une commande déjà payée',
      });
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelled_at = new Date();
    order.cancellation_reason = reason ?? null;
    const saved = await this.orderRepo.save(order);

    // Une commande de revente ne réserve aucun quota de catégorie (le billet
    // existe déjà) — restaurer un quota serait un bug (place fantôme en plus).
    // C'est la réservation de l'offre elle-même qu'il faut libérer.
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

  /**
   * Annule et libère le stock des commandes restées en attente de paiement
   * au-delà du délai configuré — un acheteur qui abandonne son panier sans
   * jamais payer ne doit pas bloquer indéfiniment le quota de la catégorie.
   * Appelée périodiquement par OrderCleanupService.
   */
  async releaseAbandoned(): Promise<number> {
    const { order_abandon_timeout_minutes, resale_reservation_minutes } = await this.platformConfig.get();
    const threshold = new Date(Date.now() - order_abandon_timeout_minutes * 60 * 1000);
    // Une commande de revente doit être abandonnée au même rythme que la
    // réservation de l'offre côté ticket-service, sinon la commande reste
    // PENDING_PAYMENT alors que l'offre est déjà redevenue LISTED pour un
    // autre acheteur.
    const resaleThreshold = new Date(Date.now() - resale_reservation_minutes * 60 * 1000);

    const abandoned = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.PENDING_PAYMENT })
      .andWhere(
        '(o.is_resale = false AND o.created_at < :threshold) OR (o.is_resale = true AND o.created_at < :resaleThreshold)',
        { threshold, resaleThreshold },
      )
      .getMany();

    for (const order of abandoned) {
      order.status = OrderStatus.CANCELLED;
      order.cancelled_at = new Date();
      order.cancellation_reason = 'Abandon automatique (délai de paiement dépassé)';
      await this.orderRepo.save(order);

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

    return abandoned.length;
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
