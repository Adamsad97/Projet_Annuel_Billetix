import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ValidationRequestService } from './validation-request.service';
import { EventIdPayload } from '../common/payloads';

// Lecture seule : création et réponse passent par EventService, qui vérifie statut et propriété.
@Controller()
export class ValidationRequestController {
  constructor(private readonly service: ValidationRequestService) {}

  @MessagePattern('event.get_validation_requests')
  getByEvent(@Payload() data: EventIdPayload) {
    return this.service.getByEvent(data.event_id);
  }
}
