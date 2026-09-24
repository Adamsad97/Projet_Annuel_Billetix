import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';
import { CategoryService } from '../category/category.service';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { CategoryVisibility, TicketCategory } from '../ticket-category/ticket-category.entity';
import { TicketCategoryService } from '../ticket-category/ticket-category.service';
import { ValidationRequestService } from '../validation-request/validation-request.service';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventStatus } from './event.entity';

// Une fois soumis (hors DRAFT), seuls ces champs restent modifiables — les
// autres (date, lieu, capacité...) sont dupliqués dans Order/Ticket au
// moment de l'achat et jamais resynchronisés ; les rouvrir romprait la
// cohérence des billets/commandes déjà émis.
const COSMETIC_FIELDS: Array<keyof CreateEventDto> = [
  'description',
  'poster_url',
  'access_conditions',
];

// Défense en profondeur : même si le gateway type déjà son DTO, ce handler
// TCP reste atteignable directement — seuls ces champs de CreateEventDto
// sont recopiables sur l'entité, jamais status/commission_rate/validated_by
// ou autre colonne interne au workflow de modération.
const UPDATABLE_FIELDS: Array<keyof CreateEventDto> = [
  'title',
  'description',
  'category',
  'is_non_profit',
  'non_profit_document_url',
  'start_date',
  'end_date',
  'timezone',
  'venue_name',
  'venue_address_line1',
  'venue_address_line2',
  'venue_city',
  'venue_postal_code',
  'venue_country',
  'venue_latitude',
  'venue_longitude',
  'poster_url',
  'total_capacity',
  'sales_start_date',
  'sales_end_date',
  'refund_policy',
  'refund_deadline_days',
  'access_conditions',
];

function pickUpdatableFields(dto: Partial<CreateEventDto>): Partial<CreateEventDto> {
  const picked: Partial<CreateEventDto> = {};
  for (const key of UPDATABLE_FIELDS) {
    if (key in dto) (picked as Record<string, unknown>)[key] = dto[key];
  }
  return picked;
}

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
    @InjectRepository(TicketCategory)
    private readonly ticketCategoryRepo: Repository<TicketCategory>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
    private readonly platformConfig: PlatformConfigCache,
    private readonly validationRequestService: ValidationRequestService,
    private readonly ticketCategoryService: TicketCategoryService,
    private readonly categoryService: CategoryService,
  ) {}

  /** Résout email/prénom de l'organisateur — nécessaire au bon format attendu par notification-service. */
  private async getOrganizerContact(organizerId: string): Promise<{ email: string | null; firstName: string | null }> {
    try {
      const organizer = await firstValueFrom(
        this.authClient.send('auth.get_user', { id: organizerId }),
      ) as { email: string; first_name: string } | null;
      return { email: organizer?.email ?? null, firstName: organizer?.first_name ?? null };
    } catch {
      return { email: null, firstName: null };
    }
  }

  async create(organizerId: string, dto: CreateEventDto): Promise<Event> {
    await this.categoryService.assertActive(dto.category);
    const commission_rate = await this.computeCommissionRate(dto.total_capacity, false);

    const event = this.repo.create({
      ...dto,
      organizer_id: organizerId,
      commission_rate,
      status: EventStatus.DRAFT,
    });
    return this.repo.save(event);
  }

  /**
   * Taux standard/dégressif selon la jauge (config plateforme). L'exonération
   * "à but non lucratif" du CDC ne s'applique qu'une fois le justificatif
   * validé par l'admin (cf. validate()), pas dès la création du brouillon.
   */
  private async computeCommissionRate(totalCapacity: number, isNonProfitValidated: boolean): Promise<number> {
    if (isNonProfitValidated) return 0;
    const config = await this.platformConfig.get();
    return totalCapacity > config.large_event_threshold
      ? config.commission_large_event_percent
      : config.commission_standard_percent;
  }

  /**
   * Bug corrigé : la commission 0% était accordée automatiquement dès que
   * is_non_profit=true, sans qu'aucun admin n'ait jamais vérifié le
   * justificatif — un organisateur pouvait s'auto-déclarer "à but non
   * lucratif" et obtenir l'exonération sans contrôle. Étape dédiée,
   * distincte de la validation de l'événement : l'admin examine
   * `non_profit_document_url` puis approuve ou rejette explicitement.
   * `validate()` ne consulte ensuite que `non_profit_verified` (jamais
   * `is_non_profit` directement) pour calculer la commission finale.
   */
  async verifyNonProfit(id: string, adminId: string, approved: boolean): Promise<Event> {
    const event = await this.getById(id);
    if (!event.is_non_profit) {
      throw new RpcException({
        statusCode: 400,
        message: "Cet événement n'est pas déclaré à but non lucratif",
      });
    }
    if (!event.non_profit_document_url) {
      throw new RpcException({
        statusCode: 400,
        message: 'Aucun justificatif fourni par l\'organisateur',
      });
    }
    event.non_profit_verified = approved;
    event.non_profit_verified_at = new Date();
    event.non_profit_verified_by = adminId;
    return this.repo.save(event);
  }

  /**
   * Bug corrigé (CDC §9) : notification "première vente" jamais envoyée à
   * l'organisateur. Bascule atomique (WHERE first_sale_notified = false)
   * pour ne jamais notifier deux fois même en cas d'appels concurrents —
   * appelé depuis le gateway uniquement après confirmation réelle du
   * paiement (pas à la réservation, qui peut expirer sans achat).
   */
  async markFirstSale(id: string): Promise<{ is_first_sale: boolean }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Event)
      .set({ first_sale_notified: true })
      .where('id = :id', { id })
      .andWhere('first_sale_notified = false')
      .execute();
    return { is_first_sale: (result.affected ?? 0) > 0 };
  }

  async getById(id: string): Promise<Event> {
    // Bug corrigé : un id mal formé (pas un UUID — lien cassé, faute de
    // frappe dans l'URL) faisait planter la requête Postgres avec
    // "invalid input syntax for type uuid", remonté comme un 500 brut au
    // lieu du 404 propre attendu par le frontend.
    if (!isUUID(id)) {
      throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    }
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    return event;
  }

  /** Résolution par lot (ex. liste admin des reversements, un événement par
   * payout) — évite un aller-retour par événement. */
  async getByIds(ids: string[]): Promise<Event[]> {
    if (ids.length === 0) return [];
    return this.repo.findBy({ id: In(ids) });
  }

  /**
   * Bug corrigé (CDC §3.4 : "recherche par mots-clés, filtre prix, filtre
   * distance") : le catalogue public ne proposait que catégorie/ville — pas
   * de recherche texte, pas de filtre prix, et les coordonnées GPS
   * (venue_latitude/longitude) étaient stockées mais jamais exploitées.
   */
  async listPublished(filters: {
    category?: string;
    city?: string;
    page?: number;
    q?: string;
    min_price?: number;
    max_price?: number;
    lat?: number;
    lng?: number;
    radius_km?: number;
  }): Promise<{ data: Event[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = 20;
    const queryBuilder = this.repo.createQueryBuilder('e')
      .where('e.status = :status', { status: EventStatus.PUBLISHED });

    if (filters.category) queryBuilder.andWhere('e.category = :category', { category: filters.category });
    if (filters.city) queryBuilder.andWhere('LOWER(e.venue_city) LIKE :city', { city: `%${filters.city.toLowerCase()}%` });

    // Recherche mots-clés : titre, description, lieu — toutes les colonnes
    // qu'un acheteur associerait naturellement à "chercher un événement".
    if (filters.q) {
      queryBuilder.andWhere(
        '(LOWER(e.title) LIKE :q OR LOWER(e.description) LIKE :q OR LOWER(e.venue_name) LIKE :q)',
        { q: `%${filters.q.toLowerCase()}%` },
      );
    }

    // Filtre prix : au moins une catégorie de billet publique et active dont
    // le prix TTC (TVA plateforme appliquée, comme affiché à l'achat) entre
    // dans la fourchette demandée.
    if (filters.min_price !== undefined || filters.max_price !== undefined) {
      const config = await this.platformConfig.get();
      const vatMultiplier = 1 + config.tva_rate;
      queryBuilder.andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(TicketCategory, 'tc')
          // event_id est varchar côté TicketCategory (jamais typé uuid), e.id
          // est un uuid natif — comparaison directe rejetée par Postgres
          // ("operator does not exist: character varying = uuid") sans cast.
          .where('tc.event_id = CAST(e.id AS text)')
          .andWhere('tc.visibility = :visibility')
          .andWhere('tc.is_active = true');
        if (filters.min_price !== undefined) {
          sub.andWhere(`tc.price_ht * :vatMultiplier >= :minPrice`);
        }
        if (filters.max_price !== undefined) {
          sub.andWhere(`tc.price_ht * :vatMultiplier <= :maxPrice`);
        }
        return `EXISTS ${sub.getQuery()}`;
      });
      queryBuilder.setParameters({
        visibility: CategoryVisibility.PUBLIC,
        vatMultiplier,
        ...(filters.min_price !== undefined ? { minPrice: filters.min_price } : {}),
        ...(filters.max_price !== undefined ? { maxPrice: filters.max_price } : {}),
      });
    }

    // Filtre distance : formule de Haversine directement en SQL (évite de
    // charger tous les événements en mémoire pour les filtrer côté Node).
    // Rayon terrestre moyen 6371 km.
    if (filters.lat !== undefined && filters.lng !== undefined && filters.radius_km !== undefined) {
      queryBuilder
        .andWhere('e.venue_latitude IS NOT NULL')
        .andWhere('e.venue_longitude IS NOT NULL')
        .andWhere(
          `(6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(:lat)) * cos(radians(e.venue_latitude)) *
              cos(radians(e.venue_longitude) - radians(:lng)) +
              sin(radians(:lat)) * sin(radians(e.venue_latitude))
            ))
          )) <= :radiusKm`,
          { lat: filters.lat, lng: filters.lng, radiusKm: filters.radius_km },
        );
    }

    queryBuilder
      .orderBy('e.start_date', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /** Événements candidats pour la recommandation par email (CDC — suggestions
   * basées sur les achats précédents) : publiés, à venir, d'une catégorie
   * donnée, en excluant ceux déjà achetés par ce destinataire. */
  async listForRecommendation(
    category: string,
    excludeEventIds: string[],
    limit: number,
  ): Promise<Event[]> {
    const queryBuilder = this.repo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('e.category = :category', { category })
      .andWhere('e.start_date > NOW()');

    if (excludeEventIds.length > 0) {
      queryBuilder.andWhere('e.id NOT IN (:...excludeEventIds)', { excludeEventIds });
    }

    return queryBuilder.orderBy('e.start_date', 'ASC').take(limit).getMany();
  }

  async listPending(): Promise<Array<Event & { validation_deadline: Date; is_overdue: boolean }>> {
    const events = await this.repo.find({
      where: { status: EventStatus.PENDING_VALIDATION },
      order: { validation_requested_at: 'ASC' },
    });

    return Promise.all(
      events.map(async (event) => {
        const validation_deadline = await this.computeValidationDeadline(event);
        return {
          ...event,
          validation_deadline,
          is_overdue: validation_deadline.getTime() < Date.now(),
        };
      }),
    );
  }

  /**
   * Délai de traitement (48h ouvrées par défaut, configurable admin) écoulé
   * depuis la soumission, en ajoutant le temps passé en attente d'une réponse
   * de l'organisateur à chaque demande de complément d'info (délai suspendu
   * pendant ce temps, cf. CDC section 3.3).
   */
  private async computeValidationDeadline(event: Event): Promise<Date> {
    const config = await this.platformConfig.get();
    const requests = await this.validationRequestService.getByEvent(event.id);

    let pausedMs = 0;
    for (const request of requests) {
      const pauseEnd = request.responded_at ?? new Date();
      pausedMs += pauseEnd.getTime() - request.created_at.getTime();
    }

    const base = event.validation_requested_at ?? event.created_at;
    return new Date(
      base.getTime() + config.event_validation_deadline_hours * 60 * 60 * 1000 + pausedMs,
    );
  }

  /** Demande de complément d'information par l'admin — suspend le délai de traitement. */
  async requestInfo(eventId: string, adminId: string, message: string): Promise<{ success: true }> {
    const event = await this.getById(eventId);
    if (event.status !== EventStatus.PENDING_VALIDATION) {
      throw new RpcException({ statusCode: 400, message: "L'événement n'est pas en attente de validation" });
    }
    await this.validationRequestService.create(eventId, adminId, message);

    const { email, firstName } = await this.getOrganizerContact(event.organizer_id);
    if (email) {
      this.notifClient.emit('notification.event_info_requested', {
        email,
        firstName,
        event_id: event.id,
        event_name: event.title,
        message,
      });
    }
    return { success: true };
  }

  /** Réponse de l'organisateur à une demande de complément — relance le délai de traitement. */
  async respondToInfoRequest(requestId: string, organizerId: string, response: string): Promise<{ success: true }> {
    const request = await this.validationRequestService.getById(requestId);
    if (!request) throw new RpcException({ statusCode: 404, message: 'Demande introuvable' });

    const event = await this.getById(request.event_id);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    await this.validationRequestService.respond(requestId, response);
    event.deadline_alert_sent = false;
    await this.repo.save(event);
    return { success: true };
  }

  async listByOrganizer(organizerId: string): Promise<Event[]> {
    return this.repo.find({ where: { organizer_id: organizerId }, order: { created_at: 'DESC' } });
  }

  /**
   * Bug corrigé : la page admin "Événements" (gestion globale, tous statuts)
   * n'a jamais été reliée au backend — elle affichait des données 100%
   * fictives (lib/mock/admin-events.ts côté frontend), aucun événement
   * réel n'y apparaissait jamais. `status` filtré en SQL (léger, peu de
   * lignes) ; la recherche texte (titre/organisateur) reste côté gateway
   * après enrichissement, l'organisateur n'existant pas dans cette base.
   */
  async listAll(status?: EventStatus): Promise<Event[]> {
    return this.repo.find({
      where: status ? { status } : {},
      order: { created_at: 'DESC' },
    });
  }

  /** Répartition des événements par statut — utilisé par le dashboard KPIs admin. */
  async getCountByStatus(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.status')
      .getRawMany<{ status: string; count: string }>();

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = parseInt(row.count, 10);
    return counts;
  }

  async update(id: string, organizerId: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    if (event.status === EventStatus.DRAFT) {
      if (dto.category) await this.categoryService.assertActive(dto.category);
      Object.assign(event, pickUpdatableFields(dto));
      return this.repo.save(event);
    }

    const editableStatuses: EventStatus[] = [EventStatus.PENDING_VALIDATION, EventStatus.PUBLISHED];
    if (!editableStatuses.includes(event.status)) {
      throw new RpcException({
        statusCode: 400,
        message: "Cet événement ne peut plus être modifié dans son statut actuel",
      });
    }

    const lockedFields = Object.keys(dto).filter(
      (key) => !COSMETIC_FIELDS.includes(key as keyof CreateEventDto),
    );
    if (lockedFields.length > 0) {
      throw new RpcException({
        statusCode: 400,
        message: `Une fois soumis, seuls la description, l'affiche et les conditions d'accès restent modifiables (verrouillé : ${lockedFields.join(', ')})`,
      });
    }

    Object.assign(event, pickUpdatableFields(dto));
    return this.repo.save(event);
  }

  /**
   * Bug corrigé (règle produit) : la duplication était possible à tout
   * moment, y compris sur un événement dont il restait encore des billets
   * à vendre — créant deux événements en concurrence directe sur le même
   * stock. Réservée désormais aux événements totalement épuisés (cas
   * d'usage réel : un artiste qui rejoue le même jour, au même endroit,
   * une fois complet — pas un simple outil de clonage générique). Le
   * clone reprend les dates de l'original tel quel (à ajuster ensuite via
   * /evenements/:id/modifier, redirigé automatiquement côté frontend) et
   * n'est plus suffixé "(copie)" : il doit se présenter comme un second
   * événement à part entière, pas comme un doublon de l'original.
   */
  async duplicate(id: string, organizerId: string): Promise<Event> {
    const original = await this.getById(id);
    if (original.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    const fillStats = await this.ticketCategoryService.getFillStats(id);
    if (fillStats.total_quota === 0 || fillStats.remaining > 0) {
      throw new RpcException({
        statusCode: 400,
        message:
          'La duplication n\'est possible que lorsque tous les billets sont épuisés (ex : programmer une nouvelle date une fois complet).',
      });
    }

    const clone = this.repo.create({
      organizer_id: original.organizer_id,
      title: original.title,
      description: original.description,
      category: original.category,
      is_non_profit: original.is_non_profit,
      non_profit_document_url: original.non_profit_document_url,
      start_date: original.start_date,
      end_date: original.end_date,
      timezone: original.timezone,
      venue_name: original.venue_name,
      venue_address_line1: original.venue_address_line1,
      venue_address_line2: original.venue_address_line2,
      venue_city: original.venue_city,
      venue_postal_code: original.venue_postal_code,
      venue_country: original.venue_country,
      venue_latitude: original.venue_latitude,
      venue_longitude: original.venue_longitude,
      poster_url: original.poster_url,
      total_capacity: original.total_capacity,
      sales_start_date: original.sales_start_date,
      sales_end_date: original.sales_end_date,
      refund_policy: original.refund_policy,
      refund_deadline_days: original.refund_deadline_days,
      access_conditions: original.access_conditions,
      status: EventStatus.DRAFT,
    });
    const saved = await this.repo.save(clone);

    const categories = await this.ticketCategoryService.getByEvent(id);
    for (const category of categories) {
      await this.ticketCategoryService.create(
        {
          event_id: saved.id,
          name: category.name,
          description: category.description ?? undefined,
          price_ht: Number(category.price_ht),
          quota: category.quota,
          max_per_order: category.max_per_order,
          visibility: category.visibility,
        },
        original.organizer_id,
      );
    }

    return saved;
  }

  async submitForValidation(id: string, organizerId: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (event.status !== EventStatus.DRAFT) {
      throw new RpcException({ statusCode: 400, message: 'Seul un brouillon peut être soumis' });
    }

    // Bug corrigé : rien n'empêchait de soumettre (puis faire valider) un
    // événement sans aucune catégorie de billet — une fois publié, il
    // apparaissait dans le catalogue public sans qu'aucun achat ne soit
    // jamais possible (aucune catégorie à réserver).
    const categories = await this.ticketCategoryService.getByEvent(id);
    if (categories.length === 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'Au moins une catégorie de billet est requise avant de soumettre l\'événement',
      });
    }

    event.status = EventStatus.PENDING_VALIDATION;
    event.validation_requested_at = new Date();
    event.deadline_alert_sent = false;
    return this.repo.save(event);
  }

  async validate(id: string, adminId: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.status !== EventStatus.PENDING_VALIDATION) {
      throw new RpcException({ statusCode: 400, message: 'L\'événement n\'est pas en attente de validation' });
    }
    event.commission_rate = await this.computeCommissionRate(event.total_capacity, event.non_profit_verified);
    event.status = EventStatus.PUBLISHED;
    event.validated_at = new Date();
    event.validated_by = adminId;
    await this.repo.save(event);

    const { email, firstName } = await this.getOrganizerContact(event.organizer_id);
    if (email) {
      this.notifClient.emit('notification.event_published', {
        email,
        firstName,
        event_id: event.id,
        event_name: event.title,
      });
    }

    return event;
  }

  async reject(id: string, adminId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    if (event.status !== EventStatus.PENDING_VALIDATION) {
      throw new RpcException({ statusCode: 400, message: 'L\'événement n\'est pas en attente de validation' });
    }
    event.status = EventStatus.DRAFT;
    event.rejected_at = new Date();
    event.rejected_by = adminId;
    event.rejection_reason = dto.reason ?? null;
    await this.repo.save(event);

    const { email, firstName } = await this.getOrganizerContact(event.organizer_id);
    if (email) {
      this.notifClient.emit('notification.event_rejected', {
        email,
        firstName,
        event_id: event.id,
        event_name: event.title,
        reason: dto.reason,
      });
    }

    return event;
  }

  async suspend(id: string, adminId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    event.status = EventStatus.SUSPENDED;
    event.suspended_at = new Date();
    event.suspended_by = adminId;
    event.suspension_reason = dto.reason ?? null;
    await this.repo.save(event);

    const { email, firstName } = await this.getOrganizerContact(event.organizer_id);
    if (email) {
      this.notifClient.emit('notification.event_suspended', {
        email,
        firstName,
        event_id: event.id,
        event_name: event.title,
        reason: dto.reason,
      });
    }

    return event;
  }

  async cancel(id: string, actorId: string, dto: AdminActionDto, isAdmin: boolean): Promise<Event> {
    const event = await this.getById(id);
    if (!isAdmin && event.organizer_id !== actorId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    event.status = EventStatus.CANCELLED;
    event.cancelled_at = new Date();
    event.cancelled_by = actorId;
    event.cancellation_reason = dto.reason ?? null;
    await this.repo.save(event);

    // Note : la notification d'annulation aux acheteurs (avec remboursement) est
    // gérée par l'API Gateway (cascade par commande, cf. refundAllOrdersForEvent).
    return event;
  }
}
