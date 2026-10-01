import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { StripePaymentProvider } from './stripe.provider';

@Module({
  imports: [StripeModule],
  providers: [StripePaymentProvider],
  exports: [StripePaymentProvider],
})
export class ProvidersModule {}
