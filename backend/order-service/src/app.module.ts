import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './order/order-item.entity';
import { Order } from './order/order.entity';
import { OrderModule } from './order/order.module';
import { ReminderModule } from './scheduler/reminder.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        schema: 'orders',
        entities: [Order, OrderItem],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    ClientsModule.registerAsync([
      {
        name: 'EVENT_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('EVENT_SERVICE_HOST', 'event-service'),
            port: parseInt(config.get('EVENT_SERVICE_PORT', '3003')),
          },
        }),
      },
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
    ]),

    PlatformConfigModule,
    OrderModule,
    ReminderModule,
  ],
})
export class AppModule {}
