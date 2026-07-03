import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BuyerService } from './buyer.service';
import { UpdateBuyerProfileDto } from './dto/update-buyer-profile.dto';

@Controller()
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  @MessagePattern('user.get_buyer_profile')
  getProfile(@Payload() data: { user_id: string }) {
    return this.buyerService.getByUserId(data.user_id);
  }

  @MessagePattern('user.update_buyer_profile')
  updateProfile(@Payload() data: { user_id: string; dto: UpdateBuyerProfileDto }) {
    return this.buyerService.update(data.user_id, data.dto);
  }
}
