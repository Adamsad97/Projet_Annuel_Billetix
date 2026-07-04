import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PlatformConfigCache } from './platform-config.cache';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
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
    ]),
  ],
  providers: [PlatformConfigCache],
  exports: [PlatformConfigCache],
})
export class PlatformConfigModule {}
