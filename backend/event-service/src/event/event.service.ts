import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
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
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
    private readonly platformConfig: PlatformConfigCache,
    private readonly validationRequestService: ValidationRequestService,
    private readonly ticketCategoryService: TicketCategoryService,
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

  async getById(id: string): Promise<Event> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    return event;
  }

  async listPublished(filters: { category?: string; city?: string; page?: number }): Promise<{ data: Event[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = 20;
    const qb = this.repo.createQueryBuilder('e')
      .where('e.status = :status', { status: EventStatus.PUBLISHED })
      .orderBy('e.start_date', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.category) qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.city) qb.andWhere('LOWER(e.venue_city) LIKE :city', { city: `%${filters.city.toLowerCase()}%` });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
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
   * Duplication simple — crée un nouveau brouillon reprenant les infos et
   * catégories de billets de l'événement d'origine (quotas remis à zéro),
   * à charge pour l'organisateur d'ajuster les dates avant de soumettre.
   */
  async duplicate(id: string, organizerId: string): Promise<Event> {
    const original = await this.getById(id);
    if (original.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    const clone = this.repo.create({
      organizer_id: original.organizer_id,
      title: `${original.title} (copie)`,
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
    for (const cat of categories) {
      await this.ticketCategoryService.create(
        {
          event_id: saved.id,
          name: cat.name,
          description: cat.description ?? undefined,
          price_ht: Number(cat.price_ht),
          quota: cat.quota,
          max_per_order: cat.max_per_order,
          visibility: cat.visibility,
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
    event.commission_rate = await this.computeCommissionRate(event.total_capacity, event.is_non_profit);
    event.status = EventStatus.PUBLISHED;
    event.validated_at = new Date();
    event.validated_by = adminId;
    await this.repo.save(event);

    const { email, firstName } = await this.getOrganizerContact(event.organizer_id);
    if (email) {
      this.notifClient.emit('notification.event_published', {
        email,
        firstName,
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
