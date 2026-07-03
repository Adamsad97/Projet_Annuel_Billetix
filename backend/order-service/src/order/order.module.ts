import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockReservationModule } from '../reservation/stock-reservation.module';
import { OrderItem } from './order-item.entity';
import { Order } from './order.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    StockReservationModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
