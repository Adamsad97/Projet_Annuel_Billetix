import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrganizerProfileDto } from './dto/create-organizer-profile.dto';
import { UpdateIbanDto } from './dto/update-iban.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { UpdateOrganizerProfileDto } from './dto/update-organizer-profile.dto';
import { OrganizerService } from './organizer.service';

@Controller()
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @MessagePattern('user.create_organizer_profile')
  create(@Payload() data: { user_id: string; dto: CreateOrganizerProfileDto }) {
    return this.organizerService.create(data.user_id, data.dto);
  }

  @MessagePattern('user.get_organizer_profile')
  getProfile(@Payload() data: { user_id: string }) {
    return this.organizerService.getByUserId(data.user_id);
  }

  @MessagePattern('user.update_organizer_profile')
  updateProfile(@Payload() data: { user_id: string; dto: UpdateOrganizerProfileDto }) {
    return this.organizerService.update(data.user_id, data.dto);
  }

  @MessagePattern('user.update_iban')
  updateIban(@Payload() data: { user_id: string; dto: UpdateIbanDto }) {
    return this.organizerService.updateIban(data.user_id, data.dto);
  }

  @MessagePattern('user.get_iban')
  getIban(@Payload() data: { user_id: string }) {
    return this.organizerService.getDecryptedIban(data.user_id);
  }

  @MessagePattern('user.update_kyc')
  updateKyc(@Payload() data: { user_id: string; dto: UpdateKycDto }) {
    return this.organizerService.updateKyc(data.user_id, data.dto);
  }
}
