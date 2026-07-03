import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // À venir : TypeOrmModule, StripeModule, PayoutsModule, WebhookModule
  ],
})
export class AppModule {}
