import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Clients TCP vers chaque microservice
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.AUTH_SERVICE_PORT ?? '3001'),
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.USER_SERVICE_PORT ?? '3002'),
        },
      },
      {
        name: 'EVENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.EVENT_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.EVENT_SERVICE_PORT ?? '3003'),
        },
      },
      {
        name: 'ORDER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ORDER_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.ORDER_SERVICE_PORT ?? '3004'),
        },
      },
      {
        name: 'TICKET_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.TICKET_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.TICKET_SERVICE_PORT ?? '3005'),
        },
      },
      {
        name: 'PAYMENT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.PAYMENT_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.PAYMENT_SERVICE_PORT ?? '3006'),
        },
      },
      {
        name: 'ADMIN_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.ADMIN_SERVICE_HOST ?? 'localhost',
          port: parseInt(process.env.ADMIN_SERVICE_PORT ?? '3009'),
        },
      },
    ]),
  ],
})
export class AppModule {}
