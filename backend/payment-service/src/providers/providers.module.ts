import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { StripePaymentProvider } from './stripe.provider';
import { PaypalProvider } from './paypal.provider';
import { OrangeMoneyProvider } from './orange-money.provider';
import { WaveProvider } from './wave.provider';

@Module({
  imports: [StripeModule],
  providers: [StripePaymentProvider, PaypalProvider, OrangeMoneyProvider, WaveProvider],
  exports: [StripePaymentProvider, PaypalProvider, OrangeMoneyProvider, WaveProvider],
})
export class ProvidersModule {}
