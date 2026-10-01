import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { In, IsNull, Repository, Brackets, QueryFailedError } from 'typeorm';
import { CategoryService } from '../category/category.service';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { CategoryVisibility, TicketCategory } from '../ticket-category/ticket-category.entity';
import { TicketCategoryService } from '../ticket-category/ticket-category.service';
import { ValidationRequestService } from '../validation-request/validation-request.service';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventStatus } from './event.entity';
import { firstFreeSlug, slugify } from './slug';

// Une fois soumis (hors DRAFT), seuls ces champs restent modifiables — les
// autres (date, lieu, capacité...) sont dupliqués dans Order/Ticket au
// moment de l'achat et jamais resynchronisés ; les rouvrir romprait la
// cohérence des billets/commandes déjà émis.
const COSMETIC_FIELDS: Array<keyof CreateEventDto> = [
  'description',
  'poster_url',
  'cover_url',
  'access_conditions',
  // Nouveau justificatif après un refus : n'affecte ni billets ni commandes.
  'non_profit_document_url',
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
  'cover_url',
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

/** Filtres de la liste admin des événements (event.list_all). */
export interface AdminEventListFilters {
  status?: EventStatus;
  category?: string;
  when?: 'upcoming' | 'past';
  q?: string;
  /** Organisateurs dont le nom ou l'email correspond à q (résolus par la passerelle). */
  organizer_ids?: string[];
  sort?: 'created_desc' | 'start_asc' | 'start_desc' | 'title';
  limit?: number;
  offset?: number;
}

@Injectable()
export class EventService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventService.name);

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

  /**
   * Bug corrigé (règle produit jamais appliquée) : @IsDateString() sur le
   * DTO ne vérifie qu'un format de date valide, jamais la cohérence
   * métier — rien n'empêchait de créer un événement dans le passé, ni une
   * fin antérieure au début. `existing` sert sur update() : si seul
   * end_date change (start_date absent du dto), la comparaison se fait
   * quand même contre le start_date déjà en base.
   */
  private assertValidDates(dto: { start_date?: string; end_date?: string }, existing?: Event): void {
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : existing
        ? new Date(existing.start_date)
        : null;
    const endDate = dto.end_date
      ? new Date(dto.end_date)
      : existing
        ? new Date(existing.end_date)
        : null;

    if (dto.start_date !== undefined && startDate && startDate.getTime() < Date.now()) {
      throw new RpcException({
        statusCode: 400,
        message: 'La date de début ne peut pas être dans le passé',
      });
    }
    if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
      throw new RpcException({
        statusCode: 400,
        message: 'La date de fin doit être postérieure à la date de début',
      });
    }
  }

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
    this.assertValidDates(dto);
    const commission_rate = await this.computeCommissionRate(dto.total_capacity, false);

    const event = this.repo.create({
      ...dto,
      organizer_id: organizerId,
      commission_rate,
      status: EventStatus.DRAFT,
    });
    return this.saveWithSlug(event);
  }

  /**
   * Remplit l'adresse lisible des événements qui n'en ont pas encore
   * (créés avant son introduction). Idempotent, exécuté à chaque démarrage.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const missing = await this.repo.find({ where: { slug: IsNull() }, order: { created_at: 'ASC' } });
      for (const event of missing) await this.saveWithSlug(event);
      if (missing.length > 0) this.logger.log(`Adresse lisible attribuée à ${missing.length} événement(s)`);
    } catch (err) {
      this.logger.error(`Attribution des adresses lisibles échouée : ${(err as Error).message}`);
    }
  }

  /** Première adresse libre pour ce titre (hors l'événement lui-même). */
  private async freeSlug(title: string | undefined, excludeId?: string): Promise<string> {
    const base = slugify(title ?? '');
    const qb = this.repo
      .createQueryBuilder('e')
      .select('e.slug', 'slug')
      .where('(e.slug = :base OR e.slug LIKE :pattern)', { base, pattern: `${base}-%` });
    if (excludeId) qb.andWhere('e.id != :id', { id: excludeId });
    const rows = await qb.getRawMany<{ slug: string }>();
    return firstFreeSlug(base, rows.map((r) => r.slug));
  }

  /**
   * Enregistre en attribuant l'adresse lisible. L'index unique tranche si
   * deux créations simultanées visent la même adresse : on recalcule.
   */
  private async saveWithSlug(event: Event): Promise<Event> {
    for (let attempt = 0; ; attempt++) {
      event.slug = await this.freeSlug(event.title, event.id);
      try {
        return await this.repo.save(event);
      } catch (err) {
        const duplicate = err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === '23505';
        if (!duplicate || attempt >= 4) throw err;
      }
    }
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
  async verifyNonProfit(id: string, adminId: string, approved: boolean, reason?: string): Promise<Event> {
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
    // Une décision n'est prise qu'une fois par justificatif : un nouveau
    // justificatif de l'organisateur rouvre l'examen (cf. update()).
    if (event.non_profit_verified) {
      throw new RpcException({ statusCode: 400, message: 'Ce justificatif a déjà été validé.' });
    }
    if (event.non_profit_rejected_at) {
      throw new RpcException({
        statusCode: 400,
        message: "Ce justificatif a déjà été refusé ; l'organisateur doit en envoyer un nouveau.",
      });
    }
    const motive = reason?.trim();
    if (!approved && !motive) {
      throw new RpcException({ statusCode: 400, message: 'Le motif du refus est obligatoire.' });
    }
    event.non_profit_verified = approved;
    event.non_profit_verified_at = new Date();
    event.non_profit_verified_by = adminId;
    event.non_profit_rejected_at = approved ? null : new Date();
    event.non_profit_rejection_reason = approved ? null : motive!;
    return this.repo.save(event);
  }

  /** Nouveau justificatif : la décision précédente ne vaut plus, retour en examen. */
  private resetNonProfitReview(event: Event, dto: Partial<CreateEventDto>): void {
    if (dto.non_profit_document_url === undefined || dto.non_profit_document_url === event.non_profit_document_url) return;
    event.non_profit_verified = false;
    event.non_profit_verified_at = null;
    event.non_profit_verified_by = null;
    event.non_profit_rejected_at = null;
    event.non_profit_rejection_reason = null;
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
    // Identifiants mal formés ignorés : un seul faisait échouer toute la
    // requête (erreur SQL « invalid input syntax for type uuid »).
    const validIds = ids.filter((id) => isUUID(id));
    if (validIds.length === 0) return [];
    return this.repo.findBy({ id: In(validIds) });
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
    min_distance_km?: number;
    /** Seulement les événements mis « À la une » par un admin. */
    featured?: boolean;
    date_from?: string;
    date_to?: string;
    sort?: 'date' | 'recent' | 'price_asc' | 'price_desc';
  }): Promise<{ data: Event[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = 20;
    // Un événement désactivé par un admin reste affiché (avec son message,
    // ventes bloquées) ; seul le masquage le retire du catalogue.
    const queryBuilder = this.repo.createQueryBuilder('e')
      .where('e.status IN (:...statuses)', { statuses: [EventStatus.PUBLISHED, EventStatus.SUSPENDED] })
      .andWhere('e.is_hidden = false');

    if (filters.featured) queryBuilder.andWhere('e.featured_at IS NOT NULL');
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
    // « À moins de X km » (radius_km) ou « Plus de X km » (min_distance_km).
    const distanceKm = `(6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(:lat)) * cos(radians(e.venue_latitude)) *
              cos(radians(e.venue_longitude) - radians(:lng)) +
              sin(radians(:lat)) * sin(radians(e.venue_latitude))
            ))
          ))`;
    if (
      filters.lat !== undefined &&
      filters.lng !== undefined &&
      (filters.radius_km !== undefined || filters.min_distance_km !== undefined)
    ) {
      queryBuilder
        .andWhere('e.venue_latitude IS NOT NULL')
        .andWhere('e.venue_longitude IS NOT NULL')
        .setParameters({ lat: filters.lat, lng: filters.lng });
      if (filters.radius_km !== undefined) {
        queryBuilder.andWhere(`${distanceKm} <= :radiusKm`, { radiusKm: filters.radius_km });
      }
      if (filters.min_distance_km !== undefined) {
        queryBuilder.andWhere(`${distanceKm} > :minDistanceKm`, { minDistanceKm: filters.min_distance_km });
      }
    }

    // Période : événements qui se déroulent au moins en partie dans
    // l'intervalle demandé (un festival commencé hier reste visible aujourd'hui).
    const dateFrom = filters.date_from ? new Date(filters.date_from) : null;
    const dateTo = filters.date_to ? new Date(filters.date_to) : null;
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      queryBuilder.andWhere('e.end_date >= :dateFrom', { dateFrom });
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      queryBuilder.andWhere('e.start_date <= :dateTo', { dateTo });
    }

    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      // Prix « à partir de » : billet public et actif le moins cher. La TVA
      // est la même pour tous les événements, l'ordre HT suffit. Un événement
      // sans billet en vente passe en dernier ; à prix égal, le plus proche.
      queryBuilder
        .addSelect(
          (sub) =>
            sub
              .select('MIN(tc.price_ht)')
              .from(TicketCategory, 'tc')
              .where('tc.event_id = CAST(e.id AS text)')
              .andWhere('tc.visibility = :sortVisibility')
              .andWhere('tc.is_active = true'),
          'from_price',
        )
        .setParameter('sortVisibility', CategoryVisibility.PUBLIC)
        .orderBy('from_price', filters.sort === 'price_asc' ? 'ASC' : 'DESC', 'NULLS LAST')
        .addOrderBy('e.start_date', 'ASC');
    } else {
      queryBuilder.orderBy(filters.sort === 'recent' ? 'e.created_at' : 'e.start_date', filters.sort === 'recent' ? 'DESC' : 'ASC');
    }
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /**
   * Nombre d'événements à venir par catégorie (filtre Catégorie du site) :
   * mêmes événements que la liste publique sans autre filtre — publiés ou
   * ventes suspendues, non masqués, pas encore terminés.
   */
  async countUpcomingByCategory(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('e.status IN (:...statuses)', { statuses: [EventStatus.PUBLISHED, EventStatus.SUSPENDED] })
      .andWhere('e.is_hidden = false')
      .andWhere('e.end_date >= :now', { now: new Date() })
      .groupBy('e.category')
      .getRawMany<{ category: string; count: string }>();
    return Object.fromEntries(rows.map((row) => [row.category, Number(row.count)]));
  }

  /**
   * Nombre d'événements par période (filtre Date du site), en une requête :
   * même règle que la liste publique — un événement compte s'il se déroule
   * au moins en partie dans la période (fin après le début de la période,
   * début avant sa fin).
   */
  async countInPeriods(periods: Array<{ key: string; from: string; to?: string }>): Promise<Record<string, number>> {
    if (periods.length === 0) return {};
    const qb = this.repo
      .createQueryBuilder('e')
      .select([])
      .where('e.status IN (:...statuses)', { statuses: [EventStatus.PUBLISHED, EventStatus.SUSPENDED] })
      .andWhere('e.is_hidden = false');
    periods.forEach((period, index) => {
      const conditions = [`e.end_date >= :from${index}`];
      qb.setParameter(`from${index}`, new Date(period.from));
      if (period.to) {
        conditions.push(`e.start_date <= :to${index}`);
        qb.setParameter(`to${index}`, new Date(period.to));
      }
      qb.addSelect(`COUNT(*) FILTER (WHERE ${conditions.join(' AND ')})`, `p${index}`);
    });
    const row = await qb.getRawOne<Record<string, string>>();
    return Object.fromEntries(periods.map((period, index) => [period.key, Number(row?.[`p${index}`] ?? 0)]));
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
  /**
   * Liste admin de tous les événements : filtres (statut, catégorie, période,
   * texte ou organisateurs correspondants), tri et pagination côté base.
   */
  async listAll(filters: AdminEventListFilters = {}): Promise<{ data: Event[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 100);
    const qb = this.repo.createQueryBuilder('e').skip(filters.offset ?? 0).take(limit);

    if (filters.status) qb.andWhere('e.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.when === 'upcoming') qb.andWhere('e.end_date >= NOW()');
    if (filters.when === 'past') qb.andWhere('e.end_date < NOW()');

    const q = filters.q?.trim().toLowerCase();
    if (q) {
      const organizerIds = filters.organizer_ids ?? [];
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('LOWER(e.title) LIKE :q', { q: `%${q}%` })
            .orWhere('LOWER(e.venue_name) LIKE :q')
            .orWhere('LOWER(e.venue_city) LIKE :q');
          if (organizerIds.length) sub.orWhere('e.organizer_id IN (:...organizerIds)', { organizerIds });
        }),
      );
    }

    if (filters.sort === 'start_asc') qb.orderBy('e.start_date', 'ASC');
    else if (filters.sort === 'start_desc') qb.orderBy('e.start_date', 'DESC');
    else if (filters.sort === 'title') qb.orderBy('LOWER(e.title)', 'ASC');
    else qb.orderBy('e.created_at', 'DESC');

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
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
      if (dto.start_date !== undefined || dto.end_date !== undefined) {
        this.assertValidDates(dto, event);
      }
      const titleChanged = dto.title !== undefined && dto.title !== event.title;
      this.resetNonProfitReview(event, dto);
      Object.assign(event, pickUpdatableFields(dto));
      // Brouillon jamais publié : l'adresse suit le titre.
      return titleChanged ? this.saveWithSlug(event) : this.repo.save(event);
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
        message: `Une fois soumis, seuls la description, l'affiche, les conditions d'accès et le justificatif restent modifiables (verrouillé : ${lockedFields.join(', ')})`,
      });
    }

    this.resetNonProfitReview(event, dto);
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
      cover_url: original.cover_url,
      total_capacity: original.total_capacity,
      sales_start_date: original.sales_start_date,
      sales_end_date: original.sales_end_date,
      refund_policy: original.refund_policy,
      refund_deadline_days: original.refund_deadline_days,
      access_conditions: original.access_conditions,
      status: EventStatus.DRAFT,
    });
    const saved = await this.saveWithSlug(clone);

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
    // Bug corrigé : create()/update() rejettent désormais une date passée,
    // mais un événement resté en attente de validation assez longtemps
    // (délai de traitement, demande de complément d'info...) peut voir sa
    // date de début franchir "maintenant" avant qu'un admin ne le traite —
    // publier un événement déjà passé n'a pas de sens, mieux vaut le
    // rejeter explicitement (motif clair pour l'organisateur).
    if (new Date(event.start_date).getTime() < Date.now()) {
      throw new RpcException({
        statusCode: 400,
        message: "La date de début de cet événement est déjà passée — rejette-le plutôt que de le valider.",
      });
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

  /** Page publique : un événement masqué par un admin n'est plus accessible. */
  async getPublic(id: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.is_hidden) throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    return event;
  }

  /** Événement désigné par son adresse lisible (mêmes règles que getPublic côté appelant). */
  async getBySlug(slug: string): Promise<Event> {
    const event = await this.repo.findOne({ where: { slug } });
    if (!event) throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    return event;
  }

  /**
   * Désactivation par un admin en cas de problème : ventes bloquées, la page
   * publique reste visible avec le message de l'admin. Réversible (unsuspend).
   */
  async suspend(id: string, adminId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    if (event.status !== EventStatus.PUBLISHED) {
      throw new RpcException({ statusCode: 400, message: 'Seul un événement publié peut être désactivé.' });
    }
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new RpcException({ statusCode: 400, message: 'Le message affiché au public est obligatoire.' });
    }
    event.status = EventStatus.SUSPENDED;
    event.suspended_at = new Date();
    event.suspended_by = adminId;
    event.suspension_reason = reason;
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

  /** Réactivation d'un événement désactivé : les ventes reprennent. */
  async unsuspend(id: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.status !== EventStatus.SUSPENDED) {
      throw new RpcException({ statusCode: 400, message: "Cet événement n'est pas désactivé." });
    }
    event.status = EventStatus.PUBLISHED;
    event.suspended_at = null;
    event.suspended_by = null;
    event.suspension_reason = null;
    return this.repo.save(event);
  }

  /** Masquage par un admin : hors catalogue, page publique indisponible, ventes bloquées. */
  async hide(id: string, adminId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    const reason = dto.reason?.trim();
    if (!reason) throw new RpcException({ statusCode: 400, message: 'Le motif du masquage est obligatoire.' });
    event.is_hidden = true;
    event.hidden_at = new Date();
    event.hidden_by = adminId;
    event.hidden_reason = reason;
    return this.repo.save(event);
  }

  /**
   * « À la une » de l'accueil : seulement un événement visible du public
   * (publié ou ventes suspendues, non masqué) et pas encore terminé.
   */
  async feature(id: string, adminId: string): Promise<Event> {
    const event = await this.getById(id);
    if (![EventStatus.PUBLISHED, EventStatus.SUSPENDED].includes(event.status) || event.is_hidden) {
      throw new RpcException({ statusCode: 400, message: 'Seul un événement publié et visible peut être mis à la une.' });
    }
    if (new Date(event.end_date).getTime() < Date.now()) {
      throw new RpcException({ statusCode: 400, message: 'Cet événement est terminé : il ne peut pas être mis à la une.' });
    }
    event.featured_at = new Date();
    event.featured_by = adminId;
    return this.repo.save(event);
  }

  async unfeature(id: string): Promise<Event> {
    const event = await this.getById(id);
    event.featured_at = null;
    event.featured_by = null;
    return this.repo.save(event);
  }

  async unhide(id: string): Promise<Event> {
    const event = await this.getById(id);
    event.is_hidden = false;
    event.hidden_at = null;
    event.hidden_by = null;
    event.hidden_reason = null;
    return this.repo.save(event);
  }

  /** Report possible : événement publié, pas encore commencé. */
  assertPostponable(event: Event): void {
    if (event.status !== EventStatus.PUBLISHED) {
      throw new RpcException({ statusCode: 400, message: 'Seul un événement publié peut être reporté.' });
    }
    if (new Date(event.start_date).getTime() <= Date.now()) {
      throw new RpcException({ statusCode: 400, message: 'Cet événement a déjà commencé : il ne peut plus être reporté.' });
    }
  }

  /**
   * Nouvelle date d'un report : les deux bornes ou aucune (« date à venir »),
   * dans le futur, après la date actuelle de l'événement.
   */
  parseNewDates(event: Event, start?: string, end?: string): { start: Date; end: Date } | null {
    if (!start && !end) return null;
    if (!start || !end) {
      throw new RpcException({ statusCode: 400, message: 'Indiquez la nouvelle date de début et de fin, ou aucune des deux.' });
    }
    this.assertValidDates({ start_date: start, end_date: end });
    const newStart = new Date(start);
    if (newStart.getTime() <= new Date(event.start_date).getTime()) {
      throw new RpcException({ statusCode: 400, message: "La nouvelle date doit être postérieure à la date actuelle de l'événement." });
    }
    return { start: newStart, end: new Date(end) };
  }

  /**
   * Nouvelles dates appliquées : la date d'origine est conservée (celle de
   * l'achat), la fin des ventes est décalée d'autant.
   */
  private async moveDates(event: Event, start: Date, end: Date): Promise<void> {
    const delta = start.getTime() - new Date(event.start_date).getTime();
    if (!event.original_start_date) {
      event.original_start_date = event.start_date;
      event.original_end_date = event.end_date;
    }
    event.start_date = start;
    event.end_date = end;
    if (delta > 0) {
      event.sales_end_date = new Date(new Date(event.sales_end_date).getTime() + delta);
      await this.repo.manager.query(
        `UPDATE events.ticket_categories
            SET sales_end_date = sales_end_date + ($2 * interval '1 millisecond')
          WHERE event_id = $1 AND sales_end_date IS NOT NULL`,
        [event.id, delta],
      );
    }
    event.rescheduled_at = new Date();
  }

  /**
   * Report accepté par un admin. Avec une nouvelle date : l'événement reste
   * publié, à la nouvelle date. Sans : il passe « Reporté », ventes et
   * contrôle suspendus jusqu'à ce que l'organisateur fixe la date.
   */
  async postpone(id: string, reason: string, newDates: { start: Date; end: Date } | null): Promise<Event> {
    const event = await this.getById(id);
    this.assertPostponable(event);
    event.postponed_at = new Date();
    event.postponement_reason = reason;
    if (newDates) {
      await this.moveDates(event, newDates.start, newDates.end);
    } else {
      if (!event.original_start_date) {
        event.original_start_date = event.start_date;
        event.original_end_date = event.end_date;
      }
      event.status = EventStatus.POSTPONED;
      event.rescheduled_at = null;
    }
    return this.repo.save(event);
  }

  /** L'organisateur fixe la nouvelle date d'un événement reporté : ventes et contrôle reprennent. */
  async reschedule(id: string, organizerId: string, start: string, end: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: "Cet événement n'appartient pas à votre compte." });
    }
    if (event.status !== EventStatus.POSTPONED) {
      throw new RpcException({ statusCode: 400, message: "Seul un événement reporté attend une nouvelle date." });
    }
    const dates = this.parseNewDates(event, start, end);
    if (!dates) {
      throw new RpcException({ statusCode: 400, message: 'La nouvelle date de début et de fin est obligatoire.' });
    }
    await this.moveDates(event, dates.start, dates.end);
    event.status = EventStatus.PUBLISHED;
    return this.repo.save(event);
  }

  /**
   * Annulation définitive (remboursements déclenchés par la passerelle).
   * Réservée aux admins : un organisateur passe par une demande d'annulation
   * (CancellationService), acceptée ou refusée par un admin.
   */
  async cancel(id: string, actorId: string, dto: AdminActionDto, isAdmin: boolean): Promise<Event> {
    const event = await this.getById(id);
    if (!isAdmin) {
      throw new RpcException({
        statusCode: 403,
        message: "L'annulation d'un événement doit être approuvée par un administrateur : faites une demande d'annulation.",
      });
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new RpcException({ statusCode: 400, message: 'Cet événement est déjà annulé.' });
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
