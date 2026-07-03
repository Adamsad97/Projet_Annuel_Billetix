import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './order/order-item.entity';
import { Order } from './order/order.entity';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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

    // Client TCP vers event-service pour decrement/restore quota
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
    ]),

    OrderModule,
  ],
})
export class AppModule {}
