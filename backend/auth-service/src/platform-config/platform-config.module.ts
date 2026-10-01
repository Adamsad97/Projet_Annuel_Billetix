import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PlatformConfigCache } from './platform-config.cache';

const AdminServiceClient = ClientsModule.registerAsync([
  {
    name: 'ADMIN_SERVICE',
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      transport: Transport.TCP,
      options: {
        host: config.get('ADMIN_SERVICE_HOST', 'admin-service'),
        port: parseInt(config.get('ADMIN_SERVICE_PORT', '3009')),
      },
    }),
  },
]);

@Global()
@Module({
  imports: [AdminServiceClient],
  providers: [PlatformConfigCache],
  // ClientsModule ré-exporté pour rendre ADMIN_SERVICE injectable ailleurs (@Global ne suffit pas).
  exports: [PlatformConfigCache, AdminServiceClient],
})
export class PlatformConfigModule {}
