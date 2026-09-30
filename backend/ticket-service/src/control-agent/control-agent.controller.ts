import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ControlAgentService } from './control-agent.service';
import { AgentEventPayload, AssignAgentPayload, EventIdPayload, UserIdPayload } from '../common/payloads';

@Controller()
export class ControlAgentController {
  constructor(private readonly service: ControlAgentService) {}

  @MessagePattern('ticket.assign_agent')
  assign(@Payload() data: AssignAgentPayload) {
    return this.service.assign(data);
  }

  @MessagePattern('ticket.get_agents')
  getByEvent(@Payload() data: EventIdPayload) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('ticket.get_agent_events')
  getAgentEvents(@Payload() data: UserIdPayload) {
    return this.service.getEventIdsForAgent(data.user_id);
  }

  @MessagePattern('ticket.remove_agent')
  remove(@Payload() data: AgentEventPayload) {
    return this.service.remove(data.user_id, data.event_id);
  }
}
