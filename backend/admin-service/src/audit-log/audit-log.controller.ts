import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuditLogService, GetLogsDto, LogActionDto } from './audit-log.service';

@Controller()
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @MessagePattern('admin.log_action')
  log(@Payload() dto: LogActionDto) {
    return this.service.log(dto);
  }

  @MessagePattern('admin.get_logs')
  getLogs(@Payload() filters: GetLogsDto) {
    return this.service.getLogs(filters);
  }

  @MessagePattern('admin.get_stats')
  getStats() {
    return this.service.getStats();
  }
}
