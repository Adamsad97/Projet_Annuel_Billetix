import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { TicketCategoryService } from './ticket-category.service';

@Controller()
export class TicketCategoryController {
  constructor(private readonly service: TicketCategoryService) {}

  @MessagePattern('event.create_category')
  create(@Payload() data: { dto: CreateTicketCategoryDto; organizer_id: string }) {
    return this.service.create(data.dto, data.organizer_id);
  }

  @MessagePattern('event.get_categories')
  getByEvent(@Payload() data: { event_id: string }) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('event.update_category')
  update(@Payload() data: { id: string; dto: Partial<CreateTicketCategoryDto>; organizer_id: string }) {
    return this.service.update(data.id, data.dto, data.organizer_id);
  }

  @MessagePattern('event.deactivate_category')
  deactivate(@Payload() data: { id: string; organizer_id: string }) {
    return this.service.deactivate(data.id, data.organizer_id);
  }

  @MessagePattern('event.decrement_quota')
  decrementQuota(@Payload() data: { id: string; quantity: number }) {
    return this.service.decrementQuota(data.id, data.quantity);
  }

  @MessagePattern('event.restore_quota')
  restoreQuota(@Payload() data: { id: string; quantity: number }) {
    return this.service.restoreQuota(data.id, data.quantity);
  }

  @MessagePattern('event.get_fill_stats')
  getFillStats(@Payload() data: { event_id: string }) {
    return this.service.getFillStats(data.event_id);
  }
}
