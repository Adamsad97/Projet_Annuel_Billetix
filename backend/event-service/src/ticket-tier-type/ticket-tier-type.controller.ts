import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateTicketTierTypeDto } from './dto/create-ticket-tier-type.dto';
import { UpdateTicketTierTypeDto } from './dto/update-ticket-tier-type.dto';
import { TicketTierTypeService } from './ticket-tier-type.service';

@Controller()
export class TicketTierTypeController {
  constructor(private readonly service: TicketTierTypeService) {}

  @MessagePattern('event.ticket_tier_type.list')
  listActive() {
    return this.service.listActive();
  }

  @MessagePattern('event.ticket_tier_type.list_all')
  listAll() {
    return this.service.listAll();
  }

  @MessagePattern('event.ticket_tier_type.create')
  create(@Payload() dto: CreateTicketTierTypeDto) {
    return this.service.create(dto);
  }

  @MessagePattern('event.ticket_tier_type.update')
  update(@Payload() data: { id: string; dto: UpdateTicketTierTypeDto }) {
    return this.service.update(data.id, data.dto);
  }

  @MessagePattern('event.ticket_tier_type.delete')
  remove(@Payload() data: { id: string }) {
    return this.service.remove(data.id);
  }
}
