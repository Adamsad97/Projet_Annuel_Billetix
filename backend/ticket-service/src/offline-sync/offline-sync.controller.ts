import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OfflineScanEntry, OfflineSyncService } from './offline-sync.service';

@Controller()
export class OfflineSyncController {
  constructor(private readonly service: OfflineSyncService) {}

  @MessagePattern('ticket.sync_offline')
  sync(@Payload() data: { agent_id: string; event_id: string; entries: OfflineScanEntry[] }) {
    return this.service.syncBatch(data.agent_id, data.event_id, data.entries);
  }

  @MessagePattern('ticket.get_offline_logs')
  getLogs(@Payload() data: { event_id: string }) {
    return this.service.getLogs(data.event_id);
  }
}
