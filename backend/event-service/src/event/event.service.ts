import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventStatus } from './event.entity';

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

  async listPending(): Promise<Event[]> {
    return this.repo.find({
      where: { status: EventStatus.PENDING_VALIDATION },
      order: { validation_requested_at: 'ASC' },
    });
  }

  async listByOrganizer(organizerId: string): Promise<Event[]> {
    return this.repo.find({ where: { organizer_id: organizerId }, order: { created_at: 'DESC' } });
  }

  async update(id: string, organizerId: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (event.status !== EventStatus.DRAFT) {
      throw new RpcException({ statusCode: 400, message: 'Seul un brouillon peut être modifié' });
    }
    Object.assign(event, dto);
    return this.repo.save(event);
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
