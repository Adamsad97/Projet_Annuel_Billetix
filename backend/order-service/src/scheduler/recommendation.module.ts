import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
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
      {
        name: 'EVENT_SERVICE',
        imports: [ConfigModule],
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
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
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
  ],
  providers: [RecommendationService],
})
export class RecommendationModule {}
