import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlAgent } from './control-agent/control-agent.entity';
import { ControlAgentModule } from './control-agent/control-agent.module';
import { OfflineSyncLog } from './offline-sync/offline-sync-log.entity';
import { OfflineSyncModule } from './offline-sync/offline-sync.module';
import { TicketResale } from './resale/ticket-resale.entity';
import { TicketResaleModule } from './resale/ticket-resale.module';
import { ScanLog } from './scan/scan-log.entity';
import { ScanModule } from './scan/scan.module';
import { Ticket } from './ticket/ticket.entity';
import { TicketModule } from './ticket/ticket.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'tickets',
        entities: [Ticket, ScanLog, OfflineSyncLog, ControlAgent, TicketResale],
        synchronize: config.get('NODE_ENV') !== 'production',
        migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
        migrationsRun: config.get('NODE_ENV') === 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    PlatformConfigModule,
    TicketModule,
    TicketResaleModule,
    ScanModule,
    OfflineSyncModule,
    ControlAgentModule,
  ],
})
export class AppModule {}
