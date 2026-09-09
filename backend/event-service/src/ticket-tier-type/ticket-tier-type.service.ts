import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategory } from '../ticket-category/ticket-category.entity';
import { CreateTicketTierTypeDto } from './dto/create-ticket-tier-type.dto';
import { UpdateTicketTierTypeDto } from './dto/update-ticket-tier-type.dto';
import { TicketTierType } from './ticket-tier-type.entity';

@Injectable()
export class TicketTierTypeService {
  constructor(
    @InjectRepository(TicketTierType)
    private readonly repo: Repository<TicketTierType>,
    @InjectRepository(TicketCategory)
    private readonly ticketCategoryRepo: Repository<TicketCategory>,
  ) {}

  /** Noms actifs, pour le dropdown organisateur à la création d'une catégorie de billet. */
  listActive(): Promise<TicketTierType[]> {
    return this.repo.find({
      where: { is_active: true },
      order: { display_order: 'ASC', label: 'ASC' },
    });
  }

  /** Tous les noms (y compris désactivés), réservé à l'espace Admin. */
  listAll(): Promise<TicketTierType[]> {
    return this.repo.find({ order: { display_order: 'ASC', label: 'ASC' } });
  }

  /** Utilisé par TicketCategoryService.create — rejette tout nom qui n'est
   * pas dans la liste gérée par l'admin, ou désactivé. */
  async assertActive(label: string): Promise<void> {
    const type = await this.repo.findOne({ where: { label } });
    if (!type || !type.is_active) {
      throw new RpcException({
        statusCode: 400,
        message: `Nom de catégorie de billet invalide ou désactivé : ${label}`,
      });
    }
  }

  async create(dto: CreateTicketTierTypeDto): Promise<TicketTierType> {
    const existing = await this.repo.findOne({ where: { label: dto.label } });
    if (existing) {
      throw new RpcException({ statusCode: 400, message: `"${dto.label}" existe déjà` });
    }
    const type = this.repo.create({
      label: dto.label,
      emoji: dto.emoji ?? null,
      display_order: dto.display_order ?? 0,
    });
    return this.repo.save(type);
  }

  async update(id: string, dto: UpdateTicketTierTypeDto): Promise<TicketTierType> {
    const type = await this.getById(id);
    if (dto.label && dto.label !== type.label) {
      const existing = await this.repo.findOne({ where: { label: dto.label } });
      if (existing) {
        throw new RpcException({ statusCode: 400, message: `"${dto.label}" existe déjà` });
      }
    }
    Object.assign(type, dto);
    // Le renommage se propage aux catégories de billets déjà créées
    // (contrainte FK ON UPDATE CASCADE, cf. migration AddTicketTierTypes).
    return this.repo.save(type);
  }

  /** Suppression définitive interdite si des catégories de billets existantes
   * utilisent encore ce nom — désactiver reste la voie normale pour le
   * retirer du dropdown sans casser l'historique. */
  async remove(id: string): Promise<{ success: true }> {
    const type = await this.getById(id);
    const usageCount = await this.ticketCategoryRepo.count({ where: { name: type.label } });
    if (usageCount > 0) {
      throw new RpcException({
        statusCode: 400,
        message: `Impossible de supprimer : ${usageCount} catégorie(s) de billet utilisent ce nom. Désactivez-le à la place.`,
      });
    }
    await this.repo.remove(type);
    return { success: true };
  }

  private async getById(id: string): Promise<TicketTierType> {
    const type = await this.repo.findOne({ where: { id } });
    if (!type) throw new RpcException({ statusCode: 404, message: 'Introuvable' });
    return type;
  }
}
