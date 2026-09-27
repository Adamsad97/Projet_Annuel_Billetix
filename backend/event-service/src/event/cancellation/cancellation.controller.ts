import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CancellationMessageAuthor } from './cancellation-message.entity';
import { CancellationRequestStatus } from './cancellation-request.entity';
import { CancellationService } from './cancellation.service';

@Controller()
export class CancellationController {
  constructor(private readonly service: CancellationService) {}

  @MessagePattern('event.cancellation.request')
  request(@Payload() data: { event_id: string; organizer_id: string; reason?: string }) {
    return this.service.request(data.event_id, data.organizer_id, data.reason);
  }

  @MessagePattern('event.cancellation.list_by_event')
  listByEvent(@Payload() data: { event_id: string; organizer_id?: string }) {
    return this.service.listByEvent(data.event_id, data.organizer_id);
  }

  @MessagePattern('event.cancellation.get')
  get(@Payload() data: { id: string }) {
    return this.service.getById(data.id);
  }

  @MessagePattern('event.cancellation.list_admin')
  listForAdmin(@Payload() data: { status?: CancellationRequestStatus; limit?: number; offset?: number }) {
    return this.service.listForAdmin(data ?? {});
  }

  @MessagePattern('event.cancellation.count_pending')
  countPending() {
    return this.service.countPending();
  }

  @MessagePattern('event.cancellation.message')
  message(@Payload() data: { id: string; author_id: string; author_role: CancellationMessageAuthor; message?: string }) {
    return this.service.addMessage(data.id, data.author_id, data.author_role, data.message);
  }

  @MessagePattern('event.cancellation.withdraw')
  withdraw(@Payload() data: { id: string; organizer_id: string }) {
    return this.service.withdraw(data.id, data.organizer_id);
  }

  @MessagePattern('event.cancellation.reject')
  reject(@Payload() data: { id: string; admin_id: string; message?: string }) {
    return this.service.reject(data.id, data.admin_id, data.message);
  }

  @MessagePattern('event.cancellation.approve')
  approve(@Payload() data: { id: string; admin_id: string; message?: string }) {
    return this.service.approve(data.id, data.admin_id, data.message);
  }
}
