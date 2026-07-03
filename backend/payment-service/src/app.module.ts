import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment/payment.entity';
import { Payout } from './payout/payout.entity';
import { Dispute } from './dispute/dispute.entity';
import { PaymentModule } from './payment/payment.module';
import { PayoutModule } from './payout/payout.module';
import { DisputeModule } from './dispute/dispute.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'payments',
        entities: [Payment, Payout, Dispute],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    PaymentModule,
    PayoutModule,
    DisputeModule,
  ],
})
export class AppModule {}
