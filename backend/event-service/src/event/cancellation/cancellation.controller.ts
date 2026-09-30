import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CancellationService } from './cancellation.service';
import { IdPayload } from '../../common/payloads';
import { CancellationDecisionPayload, CancellationMessagePayload, CancellationWithdrawPayload, CancellationsAdminListPayload, CancellationsByEventPayload, RequestCancellationPayload } from '../../common/module-payloads';

@Controller()
export class CancellationController {
  constructor(private readonly service: CancellationService) {}

  @MessagePattern('event.cancellation.request')
  request(@Payload() data: RequestCancellationPayload) {
    return this.service.request(data.event_id, data.organizer_id, data.reason, {
      kind: data.kind,
      new_start_date: data.new_start_date,
      new_end_date: data.new_end_date,
    });
  }

  @MessagePattern('event.cancellation.list_by_event')
  listByEvent(@Payload() data: CancellationsByEventPayload) {
    return this.service.listByEvent(data.event_id, data.organizer_id);
  }

  @MessagePattern('event.cancellation.get')
  get(@Payload() data: IdPayload) {
    return this.service.getById(data.id);
  }

  @MessagePattern('event.cancellation.list_admin')
  listForAdmin(@Payload() data: CancellationsAdminListPayload) {
    return this.service.listForAdmin(data ?? {});
  }

  @MessagePattern('event.cancellation.count_pending')
  countPending() {
    return this.service.countPending();
  }

  @MessagePattern('event.cancellation.message')
  message(@Payload() data: CancellationMessagePayload) {
    return this.service.addMessage(data.id, data.author_id, data.author_role, data.message);
  }

  @MessagePattern('event.cancellation.withdraw')
  withdraw(@Payload() data: CancellationWithdrawPayload) {
    return this.service.withdraw(data.id, data.organizer_id);
  }

  @MessagePattern('event.cancellation.reject')
  reject(@Payload() data: CancellationDecisionPayload) {
    return this.service.reject(data.id, data.admin_id, data.message);
  }

  @MessagePattern('event.cancellation.approve')
  approve(@Payload() data: CancellationDecisionPayload) {
    return this.service.approve(data.id, data.admin_id, data.message);
  }
}
