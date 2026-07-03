import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ValidationRequestService } from './validation-request.service';

@Controller()
export class ValidationRequestController {
  constructor(private readonly service: ValidationRequestService) {}

  @MessagePattern('event.request_info')
  create(@Payload() data: { event_id: string; admin_id: string; message: string }) {
    return this.service.create(data.event_id, data.admin_id, data.message);
  }

  @MessagePattern('event.get_validation_requests')
  getByEvent(@Payload() data: { event_id: string }) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('event.respond_to_request')
  respond(@Payload() data: { id: string; response: string }) {
    return this.service.respond(data.id, data.response);
  }
}
