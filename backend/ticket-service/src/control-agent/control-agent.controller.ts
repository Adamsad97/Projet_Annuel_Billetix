import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ControlAgentService } from './control-agent.service';
import { AgentEventPayload, AgentSessionPayload, AssignAgentPayload, EventIdPayload } from '../common/payloads';

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

  @MessagePattern('ticket.start_session')
  startSession(@Payload() data: AgentEventPayload) {
    return this.service.startSession(data.user_id, data.event_id);
  }

  @MessagePattern('ticket.update_activity')
  updateActivity(@Payload() data: AgentSessionPayload) {
    return this.service.updateActivity(data.session_token);
  }

  @MessagePattern('ticket.end_session')
  endSession(@Payload() data: AgentEventPayload) {
    return this.service.endSession(data.user_id, data.event_id);
  }

  @MessagePattern('ticket.remove_agent')
  remove(@Payload() data: AgentEventPayload) {
    return this.service.remove(data.user_id, data.event_id);
  }
}
