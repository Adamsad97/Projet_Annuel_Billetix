import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AdminActionDto } from './dto/admin-action.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventService } from './event.service';

@Controller()
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @MessagePattern('event.create')
  create(@Payload() data: { organizer_id: string; dto: CreateEventDto }) {
    return this.eventService.create(data.organizer_id, data.dto);
  }

  @MessagePattern('event.get')
  getById(@Payload() data: { id: string }) {
    return this.eventService.getById(data.id);
  }

  @MessagePattern('event.list_published')
  listPublished(@Payload() filters: { category?: string; city?: string; page?: number }) {
    return this.eventService.listPublished(filters);
  }

  @MessagePattern('event.list_pending')
  listPending() {
    return this.eventService.listPending();
  }

  @MessagePattern('event.list_by_organizer')
  listByOrganizer(@Payload() data: { organizer_id: string }) {
    return this.eventService.listByOrganizer(data.organizer_id);
  }

  @MessagePattern('event.update')
  update(@Payload() data: { id: string; organizer_id: string; dto: Partial<CreateEventDto> }) {
    return this.eventService.update(data.id, data.organizer_id, data.dto);
  }

  @MessagePattern('event.submit_for_validation')
  submitForValidation(@Payload() data: { id: string; organizer_id: string }) {
    return this.eventService.submitForValidation(data.id, data.organizer_id);
  }

  @MessagePattern('event.validate')
  validate(@Payload() data: { id: string; admin_id: string }) {
    return this.eventService.validate(data.id, data.admin_id);
  }

  @MessagePattern('event.reject')
  reject(@Payload() data: { id: string; admin_id: string; dto: AdminActionDto }) {
    return this.eventService.reject(data.id, data.admin_id, data.dto);
  }

  @MessagePattern('event.suspend')
  suspend(@Payload() data: { id: string; admin_id: string; dto: AdminActionDto }) {
    return this.eventService.suspend(data.id, data.admin_id, data.dto);
  }

  @MessagePattern('event.cancel')
  cancel(@Payload() data: { id: string; actor_id: string; dto: AdminActionDto; is_admin?: boolean }) {
    return this.eventService.cancel(data.id, data.actor_id, data.dto, data.is_admin ?? false);
  }
}
