import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PlatformConfigService } from './platform-config.service';
import { ListSettingsPayload, UpdateSettingPayload } from '../common/payloads';

@Controller()
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @MessagePattern('admin.get_platform_config')
  getAll() {
    return this.service.getAll();
  }

  @MessagePattern('admin.list_platform_settings')
  list(@Payload() data: ListSettingsPayload = {}) {
    return this.service.list(data?.actor_role);
  }

  @MessagePattern('admin.update_platform_setting')
  update(@Payload() data: UpdateSettingPayload) {
    return this.service.update(data.key, data.value, data.actor_role);
  }
}
