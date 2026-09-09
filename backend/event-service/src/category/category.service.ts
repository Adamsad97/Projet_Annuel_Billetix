import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../event/event.entity';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /** Catégories actives, pour le dropdown organisateur et le catalogue public. */
  listActive(): Promise<Category[]> {
    return this.repo.find({
      where: { is_active: true },
      order: { display_order: 'ASC', label: 'ASC' },
    });
  }

  /** Toutes les catégories (y compris désactivées), réservé à l'espace Admin. */
  listAll(): Promise<Category[]> {
    return this.repo.find({ order: { display_order: 'ASC', label: 'ASC' } });
  }

  /** Utilisé par EventService à la création/modification d'un événement — rejette
   * tout code inconnu ou désactivé plutôt que de laisser un `category` orphelin. */
  async assertActive(code: string): Promise<void> {
    const category = await this.repo.findOne({ where: { code } });
    if (!category || !category.is_active) {
      throw new RpcException({
        statusCode: 400,
        message: `Catégorie invalide ou désactivée : ${code}`,
      });
    }
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.repo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new RpcException({ statusCode: 400, message: `Le code "${dto.code}" existe déjà` });
    }
    const category = this.repo.create({
      code: dto.code,
      label: dto.label,
      emoji: dto.emoji ?? null,
      display_order: dto.display_order ?? 0,
    });
    return this.repo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getById(id);
    Object.assign(category, dto);
    return this.repo.save(category);
  }

  /** Suppression définitive interdite si des événements référencent encore ce
   * code — désactiver (is_active=false) reste la voie normale pour "retirer"
   * une catégorie du dropdown sans casser l'historique. */
  async remove(id: string): Promise<{ success: true }> {
    const category = await this.getById(id);
    const usageCount = await this.eventRepo.count({ where: { category: category.code } });
    if (usageCount > 0) {
      throw new RpcException({
        statusCode: 400,
        message: `Impossible de supprimer : ${usageCount} événement(s) utilisent cette catégorie. Désactivez-la à la place.`,
      });
    }
    await this.repo.remove(category);
    return { success: true };
  }

  private async getById(id: string): Promise<Category> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new RpcException({ statusCode: 404, message: 'Catégorie introuvable' });
    return category;
  }
}
