import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVatRateDto, UpdateVatRateDto } from './dto/vat-rate.dto';
import { VatRate } from './vat-rate.entity';

/** Taux retenu pour un événement : valeur recopiée et libellé affiché. */
export interface ResolvedVatRate {
  rate: number;
  label: string;
}

@Injectable()
export class VatRateService implements OnModuleInit {
  private readonly logger = new Logger(VatRateService.name);

  constructor(@InjectRepository(VatRate) private readonly repo: Repository<VatRate>) {}

  /** Liste vide (première installation) : taux normal de 20 %, par défaut. */
  async onModuleInit(): Promise<void> {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(this.repo.create({ label: 'Taux normal', rate: '0.2000', is_default: true }));
        this.logger.log('Taux de TVA par défaut créé : 20 %');
      }
    } catch (err) {
      this.logger.error(`Création du taux de TVA par défaut échouée : ${(err as Error).message}`);
    }
  }

  /** Taux proposés à l'organisateur (actifs). */
  listActive(): Promise<VatRate[]> {
    return this.repo.find({ where: { is_active: true }, order: { display_order: 'ASC', rate: 'ASC' } });
  }

  /** Tous les taux, désactivés compris (espace admin). */
  listAll(): Promise<VatRate[]> {
    return this.repo.find({ order: { display_order: 'ASC', rate: 'ASC' } });
  }

  async create(dto: CreateVatRateDto): Promise<VatRate> {
    const saved = await this.repo.save(
      this.repo.create({
        label: dto.label.trim(),
        rate: dto.rate.toFixed(4),
        display_order: dto.display_order ?? 0,
        is_default: false,
      }),
    );
    if (dto.is_default) return this.makeDefault(saved);
    return saved;
  }

  async update(id: string, dto: UpdateVatRateDto): Promise<VatRate> {
    const vatRate = await this.getById(id);
    if (dto.is_active === false && vatRate.is_default) {
      throw new RpcException({ statusCode: 400, message: 'Le taux par défaut ne peut pas être désactivé : choisissez d\'abord un autre taux par défaut.' });
    }
    if (dto.is_default === false && vatRate.is_default) {
      throw new RpcException({ statusCode: 400, message: 'Il faut toujours un taux par défaut : choisissez-en un autre pour remplacer celui-ci.' });
    }
    if (dto.label !== undefined) vatRate.label = dto.label.trim();
    if (dto.rate !== undefined) vatRate.rate = dto.rate.toFixed(4);
    if (dto.display_order !== undefined) vatRate.display_order = dto.display_order;
    if (dto.is_active !== undefined) vatRate.is_active = dto.is_active;
    const saved = await this.repo.save(vatRate);
    return dto.is_default ? this.makeDefault(saved) : saved;
  }

  /**
   * Suppression possible même si des événements l'ont utilisé : ils gardent
   * leur propre copie du taux. Le taux par défaut reste indispensable.
   */
  async remove(id: string): Promise<{ success: true }> {
    const vatRate = await this.getById(id);
    if (vatRate.is_default) {
      throw new RpcException({ statusCode: 400, message: 'Le taux par défaut ne peut pas être supprimé : choisissez d\'abord un autre taux par défaut.' });
    }
    await this.repo.remove(vatRate);
    return { success: true };
  }

  /**
   * Taux à recopier sur un événement : celui choisi (actif obligatoirement),
   * sinon le taux par défaut.
   */
  async resolve(id?: string | null): Promise<ResolvedVatRate> {
    const vatRate = id
      ? await this.repo.findOne({ where: { id } })
      : await this.repo.findOne({ where: { is_default: true } });
    if (id && (!vatRate || !vatRate.is_active)) {
      throw new RpcException({ statusCode: 400, message: 'Taux de TVA invalide ou désactivé.' });
    }
    if (!vatRate) return { rate: 0.2, label: 'Taux normal' };
    return { rate: Number(vatRate.rate), label: vatRate.label };
  }

  private async makeDefault(vatRate: VatRate): Promise<VatRate> {
    if (!vatRate.is_active) {
      throw new RpcException({ statusCode: 400, message: 'Un taux désactivé ne peut pas être le taux par défaut.' });
    }
    await this.repo.manager.transaction(async (manager) => {
      await manager.update(VatRate, { is_default: true }, { is_default: false });
      await manager.update(VatRate, { id: vatRate.id }, { is_default: true });
    });
    return { ...vatRate, is_default: true };
  }

  private async getById(id: string): Promise<VatRate> {
    const vatRate = await this.repo.findOne({ where: { id } });
    if (!vatRate) throw new RpcException({ statusCode: 404, message: 'Taux de TVA introuvable' });
    return vatRate;
  }
}
