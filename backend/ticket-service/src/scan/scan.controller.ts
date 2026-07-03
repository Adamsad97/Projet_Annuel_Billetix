import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ScanDto, ScanService } from './scan.service';

@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @MessagePattern('ticket.scan')
  scan(@Payload() dto: ScanDto) {
    return this.scanService.scan(dto);
  }

  @MessagePattern('ticket.get_scan_logs')
  getLogs(@Payload() data: { event_id: string }) {
    return this.scanService.getLogsByEvent(data.event_id);
  }
}
