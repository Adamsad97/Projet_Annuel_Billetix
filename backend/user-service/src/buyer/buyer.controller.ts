import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BuyerService } from './buyer.service';
import { UpdateBuyerProfileDto } from './dto/update-buyer-profile.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

@Controller()
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  // Bug corrigé : ce handler ne sert qu'à l'auto-consultation (toujours
  // appelé avec user.sub) — un tout nouvel acheteur n'ayant jamais modifié
  // son profil (aucune ligne buyer_profiles créée pour lui) recevait une
  // 404 sur la toute première consultation de son propre profil.
  @MessagePattern('user.get_buyer_profile')
  getProfile(@Payload() data: { user_id: string }) {
    return this.buyerService.getOrCreate(data.user_id);
  }

  @MessagePattern('user.update_buyer_profile')
  updateProfile(@Payload() data: { user_id: string; dto: UpdateBuyerProfileDto }) {
    return this.buyerService.update(data.user_id, data.dto);
  }

  @MessagePattern('user.get_notification_prefs')
  getNotificationPrefs(@Payload() data: { user_id: string }) {
    return this.buyerService.getNotificationPrefs(data.user_id);
  }

  @MessagePattern('user.update_notification_prefs')
  updateNotificationPrefs(
    @Payload() data: { user_id: string; dto: UpdateNotificationPrefsDto },
  ) {
    return this.buyerService.updateNotificationPrefs(data.user_id, data.dto);
  }

  @MessagePattern('user.list_newsletter_subscribers')
  listNewsletterSubscribers() {
    return this.buyerService.listNewsletterSubscribers();
  }

  @MessagePattern('user.anonymize_buyer_profile')
  anonymize(@Payload() data: { user_id: string }) {
    return this.buyerService.anonymize(data.user_id);
  }
}
