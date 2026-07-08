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

  async create(dto: CreatePromoCodeDto, organizerId: string): Promise<PromoCode> {
    const eventRecord = await this.dataSource.query(
      `SELECT organizer_id FROM events.events WHERE id = $1`,
      [dto.event_id],
    );
    if (!eventRecord[0] || eventRecord[0].organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }

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
    message?: string;
    discount_type?: DiscountType;
    discount_value?: number;
    promo_code_id?: string;
  }> {
    const now = new Date();
    const promo = await this.repo.findOne({
      where: { event_id: eventId, code, is_active: true },
    });

    if (!promo) {
      return { valid: false, message: 'Ce code promo n\'existe pas ou a été désactivé.' };
    }
    if (promo.valid_until < now) {
      return { valid: false, message: 'Ce code promo est expiré.' };
    }
    if (promo.valid_from > now) {
      return { valid: false, message: 'Ce code promo n\'est pas encore actif.' };
    }
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return { valid: false, message: 'Ce code promo a atteint son nombre maximum d\'utilisations.' };
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
