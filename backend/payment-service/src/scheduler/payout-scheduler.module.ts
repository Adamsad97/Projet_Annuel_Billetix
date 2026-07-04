import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PayoutModule } from '../payout/payout.module';
import { PayoutSchedulerService } from './payout-scheduler.service';

@Module({
  imports: [
    PayoutModule,
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('USER_SERVICE_HOST', 'user-service'),
            port: parseInt(config.get('USER_SERVICE_PORT', '3002')),
          },
        }),
      },
    ]),
  ],
  providers: [PayoutSchedulerService],
})
export class PayoutSchedulerModule {}
