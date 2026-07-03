import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Event } from '../event/event.entity';
import { TicketCategory } from './ticket-category.entity';
import { TicketCategoryController } from './ticket-category.controller';
import { TicketCategoryService } from './ticket-category.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketCategory, Event]),
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'notification_queue',
            queueOptions: { durable: true },
            noAck: true,
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
  controllers: [TicketCategoryController],
  providers: [TicketCategoryService],
  exports: [TicketCategoryService],
})
export class TicketCategoryModule {}
