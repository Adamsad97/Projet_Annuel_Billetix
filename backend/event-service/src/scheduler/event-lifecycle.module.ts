import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../event/event.entity';
import { EventModule } from '../event/event.module';
import { EventLifecycleService } from './event-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    EventModule,
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
  providers: [EventLifecycleService],
})
export class EventLifecycleModule {}
