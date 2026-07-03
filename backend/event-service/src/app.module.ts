import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event/event.entity';
import { EventModule } from './event/event.module';
import { PromoCode } from './promo-code/promo-code.entity';
import { PromoCodeModule } from './promo-code/promo-code.module';
import { TicketCategory } from './ticket-category/ticket-category.entity';
import { TicketCategoryModule } from './ticket-category/ticket-category.module';
import { ValidationRequest } from './validation-request/validation-request.entity';
import { ValidationRequestModule } from './validation-request/validation-request.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'events',
        entities: [Event, TicketCategory, PromoCode, ValidationRequest],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    EventModule,
    TicketCategoryModule,
    PromoCodeModule,
    ValidationRequestModule,
  ],
})
export class AppModule {}
