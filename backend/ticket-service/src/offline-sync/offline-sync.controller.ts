import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OfflineSyncService } from './offline-sync.service';
import { EventIdPayload, SyncOfflinePayload } from '../common/payloads';

@Controller()
export class OfflineSyncController {
  constructor(private readonly service: OfflineSyncService) {}

  @MessagePattern('ticket.sync_offline')
  sync(@Payload() data: SyncOfflinePayload) {
    return this.service.syncBatch(data.agent_id, data.event_id, data.entries, data.is_organizer);
  }

  @MessagePattern('ticket.get_offline_logs')
  getLogs(@Payload() data: EventIdPayload) {
    return this.service.getLogs(data.event_id);
  }
}
