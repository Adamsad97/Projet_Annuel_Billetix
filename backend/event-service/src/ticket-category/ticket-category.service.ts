import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../event/event.entity';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { TicketCategory } from './ticket-category.entity';

const FILL_THRESHOLDS = [25, 50, 75, 100];

@Injectable()
export class TicketCategoryService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly repo: Repository<TicketCategory>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTicketCategoryDto): Promise<TicketCategory> {
    const category = this.repo.create({
      ...dto,
      remaining_quota: dto.quota,
    });
    return this.repo.save(category);
  }

  async getByEvent(eventId: string): Promise<TicketCategory[]> {
    return this.repo.find({ where: { event_id: eventId, is_active: true } });
  }

  async getById(id: string): Promise<TicketCategory> {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new RpcException({ statusCode: 404, message: 'Catégorie introuvable' });
    return cat;
  }

  async update(id: string, dto: Partial<CreateTicketCategoryDto>): Promise<TicketCategory> {
    const cat = await this.getById(id);
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async deactivate(id: string): Promise<{ success: boolean }> {
    await this.repo.update(id, { is_active: false });
    return { success: true };
  }

  // Décrémentation atomique — protège contre les surréservations
  async decrementQuota(id: string, quantity: number): Promise<{ success: boolean }> {
    const rows = await this.dataSource.query(
      `UPDATE events.ticket_categories
       SET remaining_quota = remaining_quota - $1
       WHERE id = $2 AND remaining_quota >= $1 AND is_active = true
       RETURNING id, event_id`,
      [quantity, id],
    );
    if (!rows[0].length) {
      throw new RpcException({ statusCode: 409, message: 'Places insuffisantes ou catégorie inactive' });
    }

    const eventId = rows[0][0].event_id as string;
    this.checkAndNotifyFillThresholds(eventId).catch(() => undefined);

    return { success: true };
  }

  private async checkAndNotifyFillThresholds(eventId: string): Promise<void> {
    const [stats] = await this.dataSource.query(
      `SELECT COALESCE(SUM(quota), 0)::int           AS total_quota,
              COALESCE(SUM(remaining_quota), 0)::int AS remaining
       FROM events.ticket_categories
       WHERE event_id = $1 AND is_active = true`,
      [eventId],
    ) as [{ total_quota: number; remaining: number }];

    if (!stats || stats.total_quota === 0) return;

    const soldCount = stats.total_quota - stats.remaining;
    const fillRate = (soldCount / stats.total_quota) * 100;

    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return;

    const alreadyNotified: number[] = Array.isArray(event.fill_thresholds_notified)
      ? event.fill_thresholds_notified
      : [];

    const newThresholds = FILL_THRESHOLDS.filter(
      (threshold) => fillRate >= threshold && !alreadyNotified.includes(threshold),
    );

    if (newThresholds.length === 0) return;

    event.fill_thresholds_notified = [...alreadyNotified, ...newThresholds];
    await this.eventRepo.save(event);

    let organizerEmail: string | null = null;
    let organizerFirstName: string | null = null;
    try {
      const organizer = await firstValueFrom(
        this.authClient.send('auth.get_user', { id: event.organizer_id }),
      ) as { email: string; first_name: string } | null;
      organizerEmail = organizer?.email ?? null;
      organizerFirstName = organizer?.first_name ?? null;
    } catch {
      // non bloquant
    }

    for (const threshold of newThresholds) {
      this.notifClient.emit('notification.fill_threshold_reached', {
        email: organizerEmail,
        firstName: organizerFirstName,
        organizer_id: event.organizer_id,
        event_id: event.id,
        event_name: event.title,
        threshold,
        sold_count: soldCount,
        total_capacity: stats.total_quota,
      });
    }
  }

  // Restauration des places en cas d'annulation de commande
  async restoreQuota(id: string, quantity: number): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `UPDATE events.ticket_categories
       SET remaining_quota = LEAST(remaining_quota + $1, quota)
       WHERE id = $2`,
      [quantity, id],
    );
    return { success: true };
  }
}
