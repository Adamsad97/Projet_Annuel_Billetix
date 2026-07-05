import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event/event.entity';
import { EventModule } from './event/event.module';
import { PromoCode } from './promo-code/promo-code.entity';
import { PromoCodeModule } from './promo-code/promo-code.module';
import { TicketCategory } from './ticket-category/ticket-category.entity';
import { TicketCategoryModule } from './ticket-category/ticket-category.module';
import { ValidationRequest } from './validation-request/validation-request.entity';
import { ValidationRequestModule } from './validation-request/validation-request.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { HealthModule } from './health/health.module';

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
        migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
        migrationsRun: config.get('NODE_ENV') === 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'notification_queue',
            queueOptions: { durable: true },
            noAck: true,
          },
        }),
      },
      {
        name: 'AUTH_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('AUTH_SERVICE_HOST', 'auth-service'),
            port: parseInt(config.get('AUTH_SERVICE_PORT', '3001')),
          },
        }),
      },
    ]),

    PlatformConfigModule,
    EventModule,
    TicketCategoryModule,
    PromoCodeModule,
    ValidationRequestModule,
    HealthModule,
  ],
})
export class AppModule {}
