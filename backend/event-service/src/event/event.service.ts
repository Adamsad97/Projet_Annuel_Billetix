import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { Event, EventStatus } from './event.entity';

const DEFAULT_COMMISSION = 5.00;

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ) {}

  async create(organizerId: string, dto: CreateEventDto): Promise<Event> {
    const event = this.repo.create({
      ...dto,
      organizer_id: organizerId,
      commission_rate: DEFAULT_COMMISSION,
      status: EventStatus.DRAFT,
    });
    return this.repo.save(event);
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
    event.status = EventStatus.PUBLISHED;
    event.validated_at = new Date();
    event.validated_by = adminId;
    return this.repo.save(event);
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
    return this.repo.save(event);
  }

  async suspend(id: string, adminId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    event.status = EventStatus.SUSPENDED;
    event.suspended_at = new Date();
    event.suspended_by = adminId;
    event.suspension_reason = dto.reason ?? null;
    return this.repo.save(event);
  }

  async cancel(id: string, actorId: string, dto: AdminActionDto): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizer_id !== actorId && !dto.reason) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    event.status = EventStatus.CANCELLED;
    event.cancelled_at = new Date();
    event.cancelled_by = actorId;
    event.cancellation_reason = dto.reason ?? null;
    return this.repo.save(event);
  }
}
