import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../order/order.entity';

const MAX_RECOMMENDATIONS_PER_EMAIL = 5;
const MAX_CANDIDATES_PER_CATEGORY = 3;

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
    @Inject('EVENT_SERVICE')
    private readonly eventClient: ClientProxy,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
  ) {}

  /**
   * Contrairement aux autres préférences (opt-out par défaut, fail-open),
   * celle-ci est opt-in (defaultEnabled: false côté frontend, cf.
   * notification-prefs.ts) — l'absence de clé, ou une erreur de lecture,
   * signifie donc "ne pas envoyer", pas l'inverse.
   */
  private async wantsRecommendations(buyerId: string): Promise<boolean> {
    try {
      const prefs = await firstValueFrom(
        this.userClient.send<Record<string, boolean>>('user.get_notification_prefs', {
          user_id: buyerId,
        }),
      );
      return prefs['recommendations'] === true;
    } catch (error) {
      this.logger.warn(
        `Préférences illisibles pour ${buyerId}, pas d'envoi (opt-in) : ${error?.message}`,
      );
      return false;
    }
  }

  // Une fois par semaine, dimanche à 8h00 UTC
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklyRecommendations(): Promise<void> {
    const orders = await this.orderRepo.find({
      where: { status: In([OrderStatus.CONFIRMED, OrderStatus.TICKETS_SENT]) },
    });

    const ordersByBuyer = new Map<string, Order[]>();
    for (const order of orders) {
      const list = ordersByBuyer.get(order.buyer_id) ?? [];
      list.push(order);
      ordersByBuyer.set(order.buyer_id, list);
    }

    this.logger.log(
      `Recommandations hebdomadaires : ${ordersByBuyer.size} acheteur(s) ayant déjà commandé à évaluer`,
    );

    let sent = 0;
    for (const [buyerId, buyerOrders] of ordersByBuyer) {
      if (!(await this.wantsRecommendations(buyerId))) continue;

      const purchasedEventIds = [...new Set(buyerOrders.map((order) => order.event_id))];
      const categories = await this.resolveCategories(purchasedEventIds);
      if (categories.length === 0) continue;

      const candidates = await this.findCandidates(categories, purchasedEventIds);
      if (candidates.length === 0) continue;

      // Bug évité : buyer_email/buyer_first_name viennent du formulaire de
      // facturation saisi à l'achat (texte libre, potentiellement fautif ou
      // périmé) — l'email réel du compte (auth-service) est la seule source
      // fiable pour une notification adressée au compte, pas à une commande.
      const buyer = await firstValueFrom(
        this.authClient.send<{ email: string; first_name: string } | null>('auth.get_user', {
          id: buyerId,
        }),
      ).catch(() => null);
      if (!buyer?.email) continue;

      this.notifClient.emit('notification.event_recommendations', {
        email: buyer.email,
        firstName: buyer.first_name,
        events: candidates.map((event) => ({
          eventId: event.id,
          eventName: event.title,
          eventDate: new Date(event.start_date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          venueName: event.venue_name,
          city: event.venue_city,
        })),
      });
      sent++;
    }

    this.logger.log(`Recommandations hebdomadaires : ${sent} email(s) envoyé(s)`);
  }

  /** Catégories des événements déjà achetés par ce compte — best-effort, un
   * événement introuvable (supprimé, event-service temporairement injoignable)
   * est simplement ignoré plutôt que de faire échouer tout le lot. */
  private async resolveCategories(eventIds: string[]): Promise<string[]> {
    const events = await Promise.all(
      eventIds.map((id) =>
        firstValueFrom(
          this.eventClient.send<{ category: string } | null>('event.get', { id }),
        ).catch(() => null),
      ),
    );
    return [...new Set(events.filter((event): event is { category: string } => !!event).map((event) => event.category))];
  }

  private async findCandidates(
    categories: string[],
    excludeEventIds: string[],
  ): Promise<
    Array<{ id: string; title: string; start_date: string; venue_name: string; venue_city: string }>
  > {
    const byCategoryResults = await Promise.all(
      categories.map((category) =>
        firstValueFrom(
          this.eventClient.send<
            Array<{ id: string; title: string; start_date: string; venue_name: string; venue_city: string }>
          >('event.list_for_recommendation', {
            category,
            exclude_event_ids: excludeEventIds,
            limit: MAX_CANDIDATES_PER_CATEGORY,
          }),
        ).catch(() => []),
      ),
    );
    return byCategoryResults.flat().slice(0, MAX_RECOMMENDATIONS_PER_EMAIL);
  }
}
