import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlAgentModule } from '../control-agent/control-agent.module';
import { TicketModule } from '../ticket/ticket.module';
import { ScanLog } from './scan-log.entity';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScanLog]),
    TicketModule,
    ControlAgentModule,
    // Statut et dates de l'événement vérifiés à chaque scan (cf. ScanService.eventGate).
    ClientsModule.registerAsync([
      {
        name: 'EVENT_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('EVENT_SERVICE_HOST', 'event-service'),
            port: parseInt(config.get('EVENT_SERVICE_PORT', '3003')),
          },
        }),
      },
    ]),
  ],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
