import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PlatformConfigService } from './platform-config.service';

@Controller()
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @MessagePattern('admin.get_platform_config')
  getAll() {
    return this.service.getAll();
  }

  @MessagePattern('admin.list_platform_settings')
  list() {
    return this.service.list();
  }

  @MessagePattern('admin.update_platform_setting')
  update(@Payload() data: { key: string; value: string }) {
    return this.service.update(data.key, data.value);
  }
}
