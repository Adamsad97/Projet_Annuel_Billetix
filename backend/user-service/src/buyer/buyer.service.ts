import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuyerProfile } from './buyer-profile.entity';
import { UpdateBuyerProfileDto } from './dto/update-buyer-profile.dto';

@Injectable()
export class BuyerService {
  constructor(
    @InjectRepository(BuyerProfile)
    private readonly repo: Repository<BuyerProfile>,
  ) {}

  async getOrCreate(userId: string): Promise<BuyerProfile> {
    let profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      profile = this.repo.create({ user_id: userId });
      await this.repo.save(profile);
    }
    return profile;
  }

  async getByUserId(userId: string): Promise<BuyerProfile> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new RpcException({ statusCode: 404, message: 'Profil acheteur introuvable' });
    }
    return profile;
  }

  async update(userId: string, dto: UpdateBuyerProfileDto): Promise<BuyerProfile> {
    const profile = await this.getOrCreate(userId);
    Object.assign(profile, dto);
    return this.repo.save(profile);
  }

  /** Droit à l'effacement RGPD — efface l'adresse de facturation. */
  async anonymize(userId: string): Promise<{ success: boolean }> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) return { success: true };

    profile.billing_address_line1 = null;
    profile.billing_address_line2 = null;
    profile.billing_city = null;
    profile.billing_postal_code = null;
    profile.billing_country = null;
    await this.repo.save(profile);
    return { success: true };
  }
}
