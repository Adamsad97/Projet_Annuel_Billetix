import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePromoCodeDto, PromoCodeService } from './promo-code.service';

@Controller()
export class PromoCodeController {
  constructor(private readonly service: PromoCodeService) {}

  @MessagePattern('event.create_promo_code')
  create(@Payload() dto: CreatePromoCodeDto) {
    return this.service.create(dto);
  }

  @MessagePattern('event.get_promo_codes')
  getByEvent(@Payload() data: { event_id: string }) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('event.validate_promo_code')
  validate(@Payload() data: { event_id: string; code: string }) {
    return this.service.validate(data.event_id, data.code);
  }

  @MessagePattern('event.increment_promo_uses')
  incrementUses(@Payload() data: { id: string }) {
    return this.service.incrementUses(data.id);
  }
}
