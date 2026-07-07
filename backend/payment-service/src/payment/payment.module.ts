import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from '../stripe/stripe.module';
import { PayoutModule } from '../payout/payout.module';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), StripeModule, PayoutModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
