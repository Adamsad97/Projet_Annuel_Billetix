import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ScanService } from './scan.service';
import { EventIdPayload, ScanPayload } from '../common/payloads';

@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @MessagePattern('ticket.scan')
  scan(@Payload() dto: ScanPayload) {
    return this.scanService.scan(dto);
  }

  @MessagePattern('ticket.get_scan_logs')
  getLogs(@Payload() data: EventIdPayload) {
    return this.scanService.getLogsByEvent(data.event_id);
  }
}
