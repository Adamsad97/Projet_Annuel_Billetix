import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PromoCodeService } from './promo-code.service';
import { EventIdPayload, IdPayload, OwnedIdPayload } from '../common/payloads';
import { CreatePromoCodePayload, ValidatePromoCodePayload } from '../common/module-payloads';

@Controller()
export class PromoCodeController {
  constructor(private readonly service: PromoCodeService) {}

  @MessagePattern('event.create_promo_code')
  create(@Payload() data: CreatePromoCodePayload) {
    return this.service.create(data.dto, data.organizer_id);
  }

  @MessagePattern('event.get_promo_codes')
  getByEvent(@Payload() data: EventIdPayload) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('event.validate_promo_code')
  validate(@Payload() data: ValidatePromoCodePayload) {
    return this.service.validate(data.event_id, data.code);
  }

  @MessagePattern('event.increment_promo_uses')
  incrementUses(@Payload() data: IdPayload) {
    return this.service.incrementUses(data.id);
  }

  @MessagePattern('event.deactivate_promo_code')
  deactivate(@Payload() data: OwnedIdPayload) {
    return this.service.deactivate(data.id, data.organizer_id);
  }
}
