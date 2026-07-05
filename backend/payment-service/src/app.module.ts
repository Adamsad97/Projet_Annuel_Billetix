import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment/payment.entity';
import { Payout } from './payout/payout.entity';
import { Dispute } from './dispute/dispute.entity';
import { PaymentModule } from './payment/payment.module';
import { PayoutModule } from './payout/payout.module';
import { DisputeModule } from './dispute/dispute.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { PayoutSchedulerModule } from './scheduler/payout-scheduler.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'payments',
        entities: [Payment, Payout, Dispute],
        synchronize: config.get('NODE_ENV') !== 'production',
        migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
        migrationsRun: config.get('NODE_ENV') === 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    PlatformConfigModule,
    PaymentModule,
    PayoutModule,
    DisputeModule,
    PayoutSchedulerModule,
    HealthModule,
  ],
})
export class AppModule {}
