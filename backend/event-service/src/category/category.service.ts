import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../event/event.entity';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** Catégories de départ, identiques à la migration AddCategoriesTable ; modifiables ensuite par l'admin. */
const DEFAULT_CATEGORIES: Array<Pick<Category, 'code' | 'label' | 'emoji' | 'display_order'>> = [
  { code: 'CONCERT', label: 'Concert', emoji: '🎵', display_order: 1 },
  { code: 'FESTIVAL', label: 'Festival', emoji: '🎪', display_order: 2 },
  { code: 'THEATRE', label: 'Théâtre', emoji: '🎭', display_order: 3 },
  { code: 'SPORT', label: 'Sport', emoji: '⚽', display_order: 4 },
  { code: 'CONFERENCE', label: 'Conférence', emoji: '💡', display_order: 5 },
  { code: 'DANSE', label: 'Danse', emoji: '💃', display_order: 6 },
  { code: 'AUTRE', label: 'Autre', emoji: '✨', display_order: 7 },
];

@Injectable()
export class CategoryService implements OnModuleInit {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /** Base neuve créée sans les migrations (synchronize en développement, CI) : catégories de départ, sinon aucun événement possible. */
  async onModuleInit(): Promise<void> {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_CATEGORIES.map((category) => this.repo.create(category)));
        this.logger.log(`${DEFAULT_CATEGORIES.length} catégories de départ créées`);
      }
    } catch (err) {
      this.logger.error(`Création des catégories de départ échouée : ${(err as Error).message}`);
    }
  }

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

  /** Rejette un code de catégorie inconnu ou désactivé à la création ou modification d'un événement. */
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

  /** Un changement de code est recopié sur les événements concernés, dans la même transaction. */
  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getById(id);
    const previousCode = category.code;
    const codeChanged = dto.code !== undefined && dto.code !== previousCode;
    if (codeChanged) {
      const taken = await this.repo.findOne({ where: { code: dto.code } });
      if (taken) throw new RpcException({ statusCode: 400, message: `Le code "${dto.code}" existe déjà` });
    }
    Object.assign(category, dto);
    if (!codeChanged) return this.repo.save(category);
    return this.repo.manager.transaction(async (manager) => {
      await manager.update(Event, { category: previousCode }, { category: dto.code });
      return manager.save(category);
    });
  }

  /** Suppression interdite si des événements utilisent ce code : le désactiver le retire de la liste. */
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
