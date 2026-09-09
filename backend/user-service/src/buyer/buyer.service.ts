import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuyerProfile } from './buyer-profile.entity';
import { UpdateBuyerProfileDto } from './dto/update-buyer-profile.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

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

  async getNotificationPrefs(userId: string): Promise<Record<string, boolean>> {
    const profile = await this.getOrCreate(userId);
    return profile.notification_preferences ?? {};
  }

  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<Record<string, boolean>> {
    const profile = await this.getOrCreate(userId);
    // Fusion plutôt que remplacement : le frontend n'envoie que les
    // préférences visibles/modifiées, pas nécessairement tout l'objet.
    profile.notification_preferences = {
      ...(profile.notification_preferences ?? {}),
      ...dto.preferences,
    };
    await this.repo.save(profile);
    return profile.notification_preferences;
  }

  /** Liste des acheteurs ayant explicitement activé la newsletter (opt-in —
   * absence de clé = non abonné, cf. defaultEnabled: false côté frontend). */
  async listNewsletterSubscribers(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('p.user_id', 'user_id')
      .where(`p.notification_preferences ->> 'newsletter' = 'true'`)
      .getRawMany<{ user_id: string }>();
    return rows.map((row) => row.user_id);
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
