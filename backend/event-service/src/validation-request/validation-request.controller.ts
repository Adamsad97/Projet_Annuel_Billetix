import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ValidationRequestService } from './validation-request.service';

// La création (event.request_info) et la réponse (event.respond_to_info_request)
// passent par EventService — qui vérifie le statut de l'événement / la
// propriété organisateur avant de déléguer ici. Ce contrôleur n'expose que
// la lecture, qui ne nécessite pas cette vérification supplémentaire.
@Controller()
export class ValidationRequestController {
  constructor(private readonly service: ValidationRequestService) {}

  @MessagePattern('event.get_validation_requests')
  getByEvent(@Payload() data: { event_id: string }) {
    return this.service.getByEvent(data.event_id);
  }
}
