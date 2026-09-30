import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrganizerService } from './organizer.service';
import { CreateOrganizerProfilePayload, SetPayoutMethodPayload, SetStripeAccountPayload, StripeOnboardedPayload, UpdateIbanPayload, UpdateKycPayload, UpdateOrganizerProfilePayload, UserIdPayload } from '../common/payloads';

@Controller()
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @MessagePattern('user.create_organizer_profile')
  create(@Payload() data: CreateOrganizerProfilePayload) {
    return this.organizerService.create(data.user_id, data.dto);
  }

  @MessagePattern('user.get_organizer_profile')
  getProfile(@Payload() data: UserIdPayload) {
    return this.organizerService.getByUserId(data.user_id);
  }

  @MessagePattern('user.update_organizer_profile')
  updateProfile(@Payload() data: UpdateOrganizerProfilePayload) {
    return this.organizerService.update(data.user_id, data.dto);
  }

  @MessagePattern('user.update_iban')
  updateIban(@Payload() data: UpdateIbanPayload) {
    return this.organizerService.updateIban(data.user_id, data.dto);
  }

  @MessagePattern('user.get_payout_account')
  getPayoutAccount(@Payload() data: UserIdPayload) {
    return this.organizerService.getPayoutAccount(data.user_id);
  }

  @MessagePattern('user.set_payout_method')
  setPayoutMethod(@Payload() data: SetPayoutMethodPayload) {
    return this.organizerService.setPayoutMethod(data.user_id, data.payout_method);
  }

  @MessagePattern('user.get_iban')
  getIban(@Payload() data: UserIdPayload) {
    return this.organizerService.getDecryptedIban(data.user_id);
  }

  @MessagePattern('user.update_kyc')
  updateKyc(@Payload() data: UpdateKycPayload) {
    return this.organizerService.updateKyc(data.user_id, data.dto);
  }

  @MessagePattern('user.set_stripe_connect_account')
  setStripeConnectAccount(@Payload() data: SetStripeAccountPayload) {
    return this.organizerService.setStripeConnectAccount(data.user_id, data.account_id);
  }

  @MessagePattern('user.set_stripe_connect_onboarded')
  setStripeConnectOnboarded(@Payload() data: StripeOnboardedPayload) {
    return this.organizerService.setStripeConnectOnboarded(data.account_id, data.onboarded);
  }

  @MessagePattern('user.list_kyc_pending')
  listKycPending() {
    return this.organizerService.listKycPending();
  }

  @MessagePattern('user.anonymize_organizer_profile')
  anonymize(@Payload() data: UserIdPayload) {
    return this.organizerService.anonymize(data.user_id);
  }
}
