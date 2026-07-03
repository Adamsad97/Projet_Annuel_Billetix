import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DiscountType, PromoCode } from './promo-code.entity';

export interface CreatePromoCodeDto {
  event_id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses?: number;
  valid_from: string;
  valid_until: string;
}

@Injectable()
export class PromoCodeService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly repo: Repository<PromoCode>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.repo.findOne({
      where: { event_id: dto.event_id, code: dto.code },
    });
    if (existing) {
      throw new RpcException({ statusCode: 409, message: 'Ce code promo existe déjà pour cet événement' });
    }
    return this.repo.save(this.repo.create(dto));
  }

  async getByEvent(eventId: string): Promise<PromoCode[]> {
    return this.repo.find({ where: { event_id: eventId } });
  }

  async validate(eventId: string, code: string): Promise<{
    valid: boolean;
    discount_type: DiscountType;
    discount_value: number;
    promo_code_id: string;
  }> {
    const now = new Date();
    const promo = await this.repo.findOne({
      where: { event_id: eventId, code, is_active: true },
    });

    if (!promo) throw new RpcException({ statusCode: 404, message: 'Code promo invalide' });
    if (promo.valid_from > now || promo.valid_until < now) {
      throw new RpcException({ statusCode: 400, message: 'Code promo expiré ou pas encore valide' });
    }
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      throw new RpcException({ statusCode: 400, message: 'Code promo épuisé' });
    }

    return {
      valid: true,
      discount_type: promo.discount_type,
      discount_value: Number(promo.discount_value),
      promo_code_id: promo.id,
    };
  }

  // Incrémentation atomique à l'usage
  async incrementUses(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE events.promo_codes SET current_uses = current_uses + 1 WHERE id = $1`,
      [id],
    );
  }

  async deactivate(id: string, organizerId: string): Promise<PromoCode> {
    const promoCode = await this.repo.findOne({ where: { id } });
    if (!promoCode) throw new RpcException({ statusCode: 404, message: 'Code promo introuvable' });

    const eventRecord = await this.dataSource.query(
      `SELECT organizer_id FROM events.events WHERE id = $1`,
      [promoCode.event_id],
    );
    if (!eventRecord[0] || eventRecord[0].organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

    promoCode.is_active = false;
    return this.repo.save(promoCode);
  }
}
