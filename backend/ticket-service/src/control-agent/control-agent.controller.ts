import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ControlAgentService } from './control-agent.service';

@Controller()
export class ControlAgentController {
  constructor(private readonly service: ControlAgentService) {}

  @MessagePattern('ticket.assign_agent')
  assign(@Payload() data: { user_id: string; event_id: string; assigned_by: string; is_supervisor?: boolean }) {
    return this.service.assign(data);
  }

  @MessagePattern('ticket.get_agents')
  getByEvent(@Payload() data: { event_id: string }) {
    return this.service.getByEvent(data.event_id);
  }

  @MessagePattern('ticket.start_session')
  startSession(@Payload() data: { user_id: string; event_id: string }) {
    return this.service.startSession(data.user_id, data.event_id);
  }

  @MessagePattern('ticket.update_activity')
  updateActivity(@Payload() data: { session_token: string }) {
    return this.service.updateActivity(data.session_token);
  }

  @MessagePattern('ticket.end_session')
  endSession(@Payload() data: { user_id: string; event_id: string }) {
    return this.service.endSession(data.user_id, data.event_id);
  }

  @MessagePattern('ticket.remove_agent')
  remove(@Payload() data: { user_id: string; event_id: string }) {
    return this.service.remove(data.user_id, data.event_id);
  }
}
