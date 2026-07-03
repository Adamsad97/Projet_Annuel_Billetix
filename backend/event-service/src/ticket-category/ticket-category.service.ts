import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { TicketCategory } from './ticket-category.entity';

@Injectable()
export class TicketCategoryService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly repo: Repository<TicketCategory>,
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
    const result = await this.dataSource.query(
      `UPDATE events.ticket_categories
       SET remaining_quota = remaining_quota - $1
       WHERE id = $2 AND remaining_quota >= $1 AND is_active = true
       RETURNING id`,
      [quantity, id],
    );
    if (!result[0].length) {
      throw new RpcException({ statusCode: 409, message: 'Places insuffisantes ou catégorie inactive' });
    }
    return { success: true };
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
